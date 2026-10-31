import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fake Supabase: one user, their profile, the payments table and the RPCs
let profile: Record<string, unknown> | null;
let payments: Record<string, Record<string, unknown>>;
let rpcCalls: [string, unknown][];

const table = (name: string) => {
  let filter: [string, unknown] | null = null;
  let patch: Record<string, unknown> | null = null;
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = (col: string, val: unknown) => {
    filter = [col, val];
    if (patch && name === 'subscription_payments') {
      Object.assign(payments[val as string], patch);
      return Promise.resolve({ error: null });
    }
    return chain;
  };
  chain.update = (p: Record<string, unknown>) => {
    patch = p;
    return chain;
  };
  chain.insert = (row: Record<string, unknown>) => {
    payments[row.order_id as string] = { status: 'pending', applied_at: null, period_end: null, ...row };
    return Promise.resolve({ error: null });
  };
  chain.maybeSingle = () =>
    Promise.resolve({
      data: name === 'profiles' ? profile : filter ? (payments[filter[1] as string] ?? null) : null,
      error: null,
    });
  return chain;
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: table,
    auth: {
      getUser: async (token: string) =>
        token === 'good' ? { data: { user: { id: 'u1', email: 'budi@example.com', user_metadata: {} } }, error: null } : { data: { user: null }, error: { message: 'no' } },
    },
    rpc: async (fn: string, args: unknown) => {
      rpcCalls.push([fn, args]);
      return { data: fn === 'expire_subscriptions' ? 3 : '2026-12-01T00:00:00Z', error: null };
    },
  }),
}));

const { GET, POST, midtransSignature, toStatus } = await import('./payments');

let midtransStatus: Record<string, unknown>;

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://db');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'secret');
  vi.stubEnv('MIDTRANS_SERVER_KEY', 'SB-Mid-server-key');
  vi.stubEnv('CRON_SECRET', 'cron-secret');
  profile = { status_subscribe: 'Free', status_user: 'pengguna360', subscription_expires_at: null, is_admin: false };
  payments = {};
  rpcCalls = [];
  midtransStatus = {};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/snap/v1/transactions')) {
        const body = JSON.parse(String(init?.body));
        return Response.json({ token: 'snap-token', redirect_url: `https://app.sandbox.midtrans.com/snap/v4/redirection/${body.transaction_details.order_id}` }, { status: 201 });
      }
      if (url.includes('/v2/')) return Response.json(midtransStatus);
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const buy = (product: string, token = 'good') =>
  POST(
    new Request('https://landscape360.test/api/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ product }),
    }),
  );

const notify = (body: Record<string, unknown>) =>
  POST(new Request('https://landscape360.test/api/payments?notify', { method: 'POST', body: JSON.stringify(body) }));

const signed = (orderId: string, statusCode: string, gross: string, extra: Record<string, unknown> = {}) => ({
  order_id: orderId,
  status_code: statusCode,
  gross_amount: gross,
  signature_key: midtransSignature(orderId, statusCode, gross, 'SB-Mid-server-key'),
  ...extra,
});

describe('/api/payments', () => {
  it('lists the products with server prices', async () => {
    const res = await GET(new Request('https://x/api/payments?products'));
    const { products } = await res.json();
    expect(products.find((p: { id: string }) => p.id === 'pro-1m')).toMatchObject({ plan: 'Pro', days: 30, price: 29000 });
  });

  it('maps Midtrans statuses', () => {
    expect(toStatus('settlement')).toBe('paid');
    expect(toStatus('capture', 'accept')).toBe('paid');
    expect(toStatus('capture', 'challenge')).toBe('pending');
    expect(toStatus('expire')).toBe('expired');
    expect(toStatus('deny')).toBe('failed');
    expect(toStatus('refund')).toBe('refunded');
    expect(toStatus('pending')).toBe('pending');
  });

  it('creates an order with the server price and returns the Snap page', async () => {
    const res = await buy('pro-1y');
    expect(res.status).toBe(201);
    const { orderId, redirectUrl } = await res.json();
    expect(orderId).toMatch(/^L360-[a-z0-9]+-[0-9a-f]{10}$/);
    expect(redirectUrl).toContain(orderId);
    expect(payments[orderId]).toMatchObject({ user_id: 'u1', product: 'pro-1y', plan: 'Pro', period_days: 365, amount: 249000 });
    const snapBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(snapBody.transaction_details.gross_amount).toBe(249000);
    expect(snapBody.callbacks.finish).toBe(`https://landscape360.test/?payment=${orderId}`);
  });

  it('refuses unknown products, guests, and plans the admin set by hand', async () => {
    expect((await buy('free-forever')).status).toBe(400);
    expect((await buy('pro-1m', 'bad')).status).toBe(401);
    profile = { status_subscribe: 'Enterprise', status_user: 'monitor360', subscription_expires_at: null, is_admin: false };
    const res = await buy('pro-1m');
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/managed by the admin/);
  });

  it('does not let a running higher plan be replaced by a lower one, but allows extending it', async () => {
    profile = { status_subscribe: 'Enterprise', status_user: 'pengguna360', subscription_expires_at: '2099-01-01T00:00:00Z', is_admin: false };
    expect((await buy('pro-1m')).status).toBe(409);
    expect((await buy('ent-user-1m')).status).toBe(201);
    expect((await buy('ent-monitor-1m')).status).toBe(201);
  });

  it('a signed notification, confirmed by Midtrans, marks the order paid and extends the plan', async () => {
    const { orderId } = await (await buy('pro-1m')).json();
    midtransStatus = { order_id: orderId, transaction_status: 'settlement', gross_amount: '29000.00', payment_type: 'qris', transaction_id: 't1' };
    const res = await notify(signed(orderId, '200', '29000.00', { transaction_status: 'settlement' }));
    expect(res.status).toBe(200);
    expect(payments[orderId]).toMatchObject({ status: 'paid', payment_type: 'qris', transaction_id: 't1' });
    expect(rpcCalls).toEqual([['apply_subscription_payment', { p_order_id: orderId }]]);
  });

  it('rejects a notification with a bad signature', async () => {
    const { orderId } = await (await buy('pro-1m')).json();
    const res = await notify({ ...signed(orderId, '200', '29000.00'), signature_key: 'forged' });
    expect(res.status).toBe(403);
    expect(payments[orderId].status).toBe('pending');
    expect(rpcCalls).toEqual([]);
  });

  it('does not grant a plan when the amount paid is not the price', async () => {
    const { orderId } = await (await buy('pro-1y')).json();
    midtransStatus = { order_id: orderId, transaction_status: 'settlement', gross_amount: '1000.00' };
    await notify(signed(orderId, '200', '1000.00'));
    expect(payments[orderId].status).toBe('failed');
    expect(rpcCalls).toEqual([]);
  });

  it('the daily cron needs the secret', async () => {
    expect((await GET(new Request('https://x/api/payments?cron'))).status).toBe(401);
    const res = await GET(new Request('https://x/api/payments?cron', { headers: { Authorization: 'Bearer cron-secret' } }));
    expect(await res.json()).toEqual({ ok: true, expired: 3 });
  });
});
