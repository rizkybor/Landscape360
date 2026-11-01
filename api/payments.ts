/**
 * Paid plans through Midtrans Snap (Vercel Function). Prepaid per period: a payment adds days
 * to the plan; nothing renews by itself. Table subscription_payments and the functions
 * apply_subscription_payment / expire_subscriptions: 20261031000023_subscription_payments.sql.
 *
 *   GET  /api/payments?products        -> public: what can be bought (prices set here, never by the browser)
 *   POST /api/payments  { product }    -> signed in: creates the order and a Snap payment page
 *                                         -> { orderId, redirectUrl, token }
 *   GET  /api/payments?order=<id>      -> signed in: the order's status (asks Midtrans if still pending)
 *   POST /api/payments?notify          -> Midtrans payment notification (signature checked, then the
 *                                         status is read back from Midtrans before anything changes)
 *   GET  /api/payments?cron            -> Vercel Cron, daily: paid plans that ran out go back to Free;
 *                                         also deletes Community live positions 30 days after their event
 *                                         (purge_community_live, 20261102000029_community_club_events.sql)
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL (or VITE_SUPABASE_URL), MIDTRANS_SERVER_KEY,
 * MIDTRANS_IS_PRODUCTION ("true" for live payments; sandbox otherwise) and CRON_SECRET.
 * In the Midtrans dashboard, set the Payment Notification URL to <site>/api/payments?notify.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

type Plan = 'Pro' | 'Enterprise';
type Role = 'pengguna360' | 'monitor360';

export interface Product {
  id: string;
  name: string;
  plan: Plan;
  role: Role;
  days: number;
  price: number; // Rupiah
}

// Keep in sync with the pricing proposal (docs/pricing). Team packages need seat management
// and come later.
export const PRODUCTS: Product[] = [
  { id: 'pro-7d', name: 'Pro Trip Pass (7 days)', plan: 'Pro', role: 'pengguna360', days: 7, price: 15000 },
  { id: 'pro-1m', name: 'Pro (1 month)', plan: 'Pro', role: 'pengguna360', days: 30, price: 29000 },
  { id: 'pro-1y', name: 'Pro (1 year)', plan: 'Pro', role: 'pengguna360', days: 365, price: 249000 },
  { id: 'ent-user-1m', name: 'Enterprise User (1 month)', plan: 'Enterprise', role: 'pengguna360', days: 30, price: 39000 },
  { id: 'ent-user-1y', name: 'Enterprise User (1 year)', plan: 'Enterprise', role: 'pengguna360', days: 365, price: 349000 },
  { id: 'ent-monitor-1m', name: 'Enterprise Monitor (1 month)', plan: 'Enterprise', role: 'monitor360', days: 30, price: 129000 },
  { id: 'ent-monitor-1y', name: 'Enterprise Monitor (1 year)', plan: 'Enterprise', role: 'monitor360', days: 365, price: 1090000 },
];

// Higher plans may be bought over lower ones, not the other way while one is running
const rank = (plan: string, role: string) => (plan === 'Enterprise' ? (role === 'monitor360' ? 3 : 2) : plan === 'Pro' ? 1 : 0);

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

function getAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new HttpError(500, 'Server is missing Supabase credentials');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function midtrans() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw new HttpError(500, 'Server is missing the Midtrans server key');
  const live = process.env.MIDTRANS_IS_PRODUCTION === 'true';
  return {
    serverKey,
    snapUrl: live ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
    statusUrl: (orderId: string) => `${live ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com'}/v2/${encodeURIComponent(orderId)}/status`,
    auth: `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`,
  };
}

async function caller(request: Request, supabase: SupabaseClient): Promise<User> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Missing access token');
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Invalid or expired session');
  return data.user;
}

/** Midtrans's signature: SHA-512 of order_id + status_code + gross_amount + server key */
export const midtransSignature = (orderId: string, statusCode: string, grossAmount: string, serverKey: string) =>
  createHash('sha512').update(`${orderId}${statusCode}${grossAmount}${serverKey}`).digest('hex');

type Status = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';

/** Midtrans transaction status to ours */
export const toStatus = (transactionStatus: string, fraudStatus?: string): Status => {
  switch (transactionStatus) {
    case 'settlement':
      return 'paid';
    case 'capture':
      return fraudStatus === 'challenge' ? 'pending' : 'paid';
    case 'deny':
    case 'cancel':
    case 'failure':
      return 'failed';
    case 'expire':
      return 'expired';
    case 'refund':
    case 'partial_refund':
    case 'chargeback':
    case 'partial_chargeback':
      return 'refunded';
    default:
      return 'pending';
  }
};

const newOrderId = () => `L360-${Date.now().toString(36)}-${randomBytes(5).toString('hex')}`;

// --- Buy -------------------------------------------------------------------------------------

async function handleCreate(request: Request) {
  const supabase = getAdminClient();
  const user = await caller(request, supabase);
  const body = (await request.json().catch(() => ({}))) as { product?: unknown };
  const product = PRODUCTS.find((p) => p.id === body.product);
  if (!product) throw new HttpError(400, 'Unknown product');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('status_subscribe, status_user, subscription_expires_at, is_admin')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw new HttpError(500, profileError.message);
  const plan = profile?.status_subscribe ?? 'Free';
  const role = profile?.status_user ?? 'pengguna360';
  const expires = profile?.subscription_expires_at ? Date.parse(profile.subscription_expires_at) : null;

  if (!profile?.is_admin) {
    // A plan the admin set by hand (no end date) is not replaced by a purchase
    if (plan !== 'Free' && expires === null) {
      throw new HttpError(409, 'Your plan is managed by the admin. Contact us to change it.');
    }
    // While a paid plan runs, only the same plan (to extend it) or a higher one can be bought
    if (expires !== null && expires > Date.now() && rank(product.plan, product.role) < rank(plan, role)) {
      throw new HttpError(409, `Your ${plan} plan runs until ${new Date(expires).toISOString().slice(0, 10)}. Extend it, or buy a higher plan.`);
    }
  }

  const mt = midtrans();
  const orderId = newOrderId();
  const { error: insertError } = await supabase.from('subscription_payments').insert({
    order_id: orderId,
    user_id: user.id,
    product: product.id,
    plan: product.plan,
    role: product.role,
    period_days: product.days,
    amount: product.price,
  });
  if (insertError) throw new HttpError(500, insertError.message);

  const origin = new URL(request.url).origin;
  const res = await fetch(mt.snapUrl, {
    method: 'POST',
    headers: { Authorization: mt.auth, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: product.price },
      item_details: [{ id: product.id, name: product.name.slice(0, 50), price: product.price, quantity: 1 }],
      customer_details: {
        email: user.email,
        first_name: ((user.user_metadata?.display_name as string | undefined) ?? '').slice(0, 50) || undefined,
      },
      callbacks: { finish: `${origin}/?payment=${orderId}` },
      // An unpaid order closes after a day
      expiry: { unit: 'hours', duration: 24 },
    }),
  });
  const snap = (await res.json().catch(() => ({}))) as { token?: string; redirect_url?: string; error_messages?: string[] };
  if (!res.ok || !snap.redirect_url) {
    await supabase.from('subscription_payments').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('order_id', orderId);
    throw new HttpError(502, `Midtrans: ${snap.error_messages?.join(', ') ?? res.status}`);
  }
  return json({ orderId, redirectUrl: snap.redirect_url, token: snap.token }, 201);
}

// --- Status from Midtrans, saved and applied --------------------------------------------------

type MidtransStatus = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
  signature_key?: string;
};

/** Reads the order's status from Midtrans and records it; a paid order extends the plan once */
async function syncOrder(supabase: SupabaseClient, orderId: string, notification?: MidtransStatus) {
  const mt = midtrans();
  const res = await fetch(mt.statusUrl(orderId), { headers: { Authorization: mt.auth, Accept: 'application/json' } });
  const remote = (await res.json().catch(() => ({}))) as MidtransStatus;
  // 404: no payment chosen yet on the Snap page
  if (!res.ok || !remote.transaction_status) return null;

  const { data: order, error } = await supabase
    .from('subscription_payments')
    .select('order_id, amount, status, applied_at')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!order) throw new HttpError(404, 'Unknown order');

  let status = toStatus(remote.transaction_status, remote.fraud_status);
  // The amount paid must be what was asked
  if (status === 'paid' && Math.round(Number(remote.gross_amount)) !== order.amount) status = 'failed';
  // A paid order does not go back to pending or failed (only a refund changes it)
  if (order.status === 'paid' && status !== 'refunded') status = 'paid';

  const { error: updateError } = await supabase
    .from('subscription_payments')
    .update({
      status,
      payment_type: remote.payment_type ?? null,
      transaction_id: remote.transaction_id ?? null,
      last_notification: notification ?? remote,
      ...(status === 'paid' && order.status !== 'paid' && { paid_at: new Date().toISOString() }),
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId);
  if (updateError) throw new HttpError(500, updateError.message);

  if (status === 'paid') {
    const { error: applyError } = await supabase.rpc('apply_subscription_payment', { p_order_id: orderId });
    if (applyError) throw new HttpError(500, applyError.message);
  }
  return status;
}

async function handleNotify(request: Request) {
  const body = (await request.json().catch(() => null)) as MidtransStatus | null;
  if (!body?.order_id || !body.status_code || !body.gross_amount || !body.signature_key) {
    throw new HttpError(400, 'Not a Midtrans notification');
  }
  const { serverKey } = midtrans();
  if (midtransSignature(body.order_id, body.status_code, body.gross_amount, serverKey) !== body.signature_key) {
    throw new HttpError(403, 'Bad signature');
  }
  // Midtrans also sends notifications for orders that are not ours (other apps on the account)
  if (!body.order_id.startsWith('L360-')) return json({ ok: true, ignored: true });
  const status = await syncOrder(getAdminClient(), body.order_id, body);
  return json({ ok: true, status });
}

async function handleOrder(request: Request, orderId: string) {
  const supabase = getAdminClient();
  const user = await caller(request, supabase);
  const { data: order, error } = await supabase
    .from('subscription_payments')
    .select('order_id, user_id, product, status, amount, period_end')
    .eq('order_id', orderId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!order || order.user_id !== user.id) throw new HttpError(404, 'Unknown order');
  // Back from the Snap page before the notification arrived: ask Midtrans
  let status = order.status as Status;
  let periodEnd = order.period_end as string | null;
  if (status === 'pending') {
    status = (await syncOrder(supabase, orderId)) ?? 'pending';
    if (status === 'paid') {
      const { data } = await supabase.from('subscription_payments').select('period_end').eq('order_id', orderId).maybeSingle();
      periodEnd = data?.period_end ?? null;
    }
  }
  return json({ orderId, product: order.product, amount: order.amount, status, periodEnd });
}

async function handleCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) throw new HttpError(401, 'Not allowed');
  const supabase = getAdminClient();
  const { data, error } = await supabase.rpc('expire_subscriptions');
  if (error) throw new HttpError(500, error.message);
  // A failure here (e.g. the Community migration not run yet) must not stop the plan expiry
  const purge = await supabase.rpc('purge_community_live');
  if (purge.error) console.error('purge_community_live failed:', purge.error.message);
  return json({ ok: true, expired: data, livePositionsPurged: purge.error ? null : purge.data });
}

const withErrors =
  (handler: (request: Request) => Promise<Response>) =>
  async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error('payments error:', err);
      return json({ error: 'Internal server error' }, 500);
    }
  };

export const GET = withErrors(async (request) => {
  const params = new URL(request.url).searchParams;
  if (params.has('products')) {
    return json({ products: PRODUCTS.map(({ id, name, plan, role, days, price }) => ({ id, name, plan, role, days, price })) });
  }
  if (params.has('cron')) return handleCron(request);
  const order = params.get('order');
  if (order) return handleOrder(request, order);
  throw new HttpError(400, 'Unknown request');
});

export const POST = withErrors(async (request) => {
  if (new URL(request.url).searchParams.has('notify')) return handleNotify(request);
  return handleCreate(request);
});
