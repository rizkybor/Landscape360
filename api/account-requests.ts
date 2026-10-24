/**
 * Account requests (Vercel Function).
 *
 *   POST   /api/account-requests                  -> public: submit a request
 *            { email, fullName, organization?, phone?, requestedPlan?, message?, website? }
 *   GET    /api/account-requests?status=<status>  -> admin: list requests (pending|approved|rejected|all)
 *   PATCH  /api/account-requests                  -> admin: review a pending request
 *            { id, action: 'approve', password, plan, role, displayName? }  creates the account
 *            { id, action: 'reject', note? }
 *   DELETE /api/account-requests?id=<uuid>        -> admin: delete a request
 *
 * Admin calls must send the caller's Supabase access token as `Authorization: Bearer <token>`
 * and the caller must have profiles.is_admin = true.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (or VITE_SUPABASE_URL)
 * in the Vercel project environment variables.
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

// Keep in sync with src/lib/accountRequests.ts and api/admin-users.ts
const PLANS = ['Free', 'Pro', 'Enterprise'];
const ROLES = ['pengguna360', 'monitor360'];
const STATUSES = ['pending', 'approved', 'rejected'];
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Flood guard for the public endpoint: new requests accepted per hour across all visitors
const MAX_REQUESTS_PER_HOUR = 30;

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
  if (!url || !key) {
    throw new HttpError(500, 'Server is missing Supabase credentials');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function authorize(request: Request, supabase: SupabaseClient): Promise<User> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Missing access token');

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Invalid or expired session');

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError) throw new HttpError(500, profileError.message);
  if (!profile?.is_admin) throw new HttpError(403, 'Not allowed');

  return data.user;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === 'object') return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError(400, 'Invalid JSON body');
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${field} must be at most ${maxLength} characters`);
  }
  return trimmed || undefined;
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === '23505';
}

// --- Public ---

async function handleSubmit(request: Request) {
  const body = await readBody(request);

  // Honeypot: the field is hidden in the form, so only bots fill it in. Pretend it worked.
  if (body.website) return json({ ok: true }, 201);

  const email = optionalString(body.email, 'email', 254)?.toLowerCase();
  const fullName = optionalString(body.fullName, 'fullName', 120);
  const organization = optionalString(body.organization, 'organization', 120);
  const phone = optionalString(body.phone, 'phone', 30);
  const message = optionalString(body.message, 'message', 1000);
  const requestedPlan = optionalString(body.requestedPlan, 'requestedPlan', 20) ?? 'Free';

  if (!email || !EMAIL_PATTERN.test(email)) throw new HttpError(400, 'A valid email is required');
  if (!fullName) throw new HttpError(400, 'Full name is required');
  if (!PLANS.includes(requestedPlan)) {
    throw new HttpError(400, `requestedPlan must be one of ${PLANS.join(', ')}`);
  }

  const supabase = getAdminClient();

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from('account_requests')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since);
  if (countError) throw new HttpError(500, countError.message);
  if ((count ?? 0) >= MAX_REQUESTS_PER_HOUR) {
    throw new HttpError(429, 'Too many requests right now. Please try again later.');
  }

  // Same response whether or not the email already has an account or an open request,
  // so this public endpoint cannot be used to find out which emails are registered.
  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
    .limit(1);
  if (existingError) throw new HttpError(500, existingError.message);
  if (existing && existing.length > 0) return json({ ok: true }, 201);

  const { error } = await supabase.from('account_requests').insert({
    email,
    full_name: fullName,
    organization: organization ?? null,
    phone: phone ?? null,
    requested_plan: requestedPlan,
    message: message ?? null,
  });
  if (error && !isUniqueViolation(error)) throw new HttpError(500, error.message);

  return json({ ok: true }, 201);
}

// --- Admin ---

async function handleList(request: Request, supabase: SupabaseClient) {
  const status = new URL(request.url).searchParams.get('status') ?? 'pending';
  if (status !== 'all' && !STATUSES.includes(status)) {
    throw new HttpError(400, `status must be one of ${[...STATUSES, 'all'].join(', ')}`);
  }

  let query = supabase
    .from('account_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new HttpError(500, error.message);

  const { count: pendingCount, error: countError } = await supabase
    .from('account_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (countError) throw new HttpError(500, countError.message);

  const requests = (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    fullName: r.full_name,
    organization: r.organization,
    phone: r.phone,
    requestedPlan: r.requested_plan,
    message: r.message,
    status: r.status,
    adminNote: r.admin_note,
    userId: r.user_id,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
  }));

  return json({ requests, pendingCount: pendingCount ?? 0 });
}

async function getPendingRequest(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase
    .from('account_requests')
    .select('id, email, full_name, status')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message);
  if (!data) throw new HttpError(404, 'Request not found');
  if (data.status !== 'pending') throw new HttpError(409, `Request is already ${data.status}`);
  return data;
}

async function handleApprove(
  body: Record<string, unknown>,
  id: string,
  supabase: SupabaseClient,
  admin: User,
) {
  const password = optionalString(body.password, 'password', 72);
  const displayName = optionalString(body.displayName, 'displayName', 120);
  const plan = optionalString(body.plan, 'plan', 20) ?? 'Free';
  const role = optionalString(body.role, 'role', 20) ?? 'pengguna360';

  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!PLANS.includes(plan)) throw new HttpError(400, `plan must be one of ${PLANS.join(', ')}`);
  if (!ROLES.includes(role)) throw new HttpError(400, `role must be one of ${ROLES.join(', ')}`);

  const pending = await getPendingRequest(supabase, id);

  const { data, error } = await supabase.auth.admin.createUser({
    email: pending.email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName ?? pending.full_name },
  });
  if (error || !data.user) throw new HttpError(400, error?.message ?? 'Failed to create user');

  // The signup trigger may already have inserted a Free profile; upsert overrides it
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      { id: data.user.id, email: pending.email, status_subscribe: plan, status_user: role },
      { onConflict: 'id' },
    );
  if (profileError) {
    throw new HttpError(500, `User created but profile update failed: ${profileError.message}`);
  }

  const { error: updateError } = await supabase
    .from('account_requests')
    .update({
      status: 'approved',
      user_id: data.user.id,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (updateError) {
    throw new HttpError(500, `User created but request update failed: ${updateError.message}`);
  }

  return json({ ok: true, userId: data.user.id });
}

async function handleReject(
  body: Record<string, unknown>,
  id: string,
  supabase: SupabaseClient,
  admin: User,
) {
  const note = optionalString(body.note, 'note', 500);
  await getPendingRequest(supabase, id);

  const { error } = await supabase
    .from('account_requests')
    .update({
      status: 'rejected',
      admin_note: note ?? null,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw new HttpError(500, error.message);

  return json({ ok: true });
}

async function handleReview(request: Request, supabase: SupabaseClient, admin: User) {
  const body = await readBody(request);
  const id = optionalString(body.id, 'id', 64);
  if (!id) throw new HttpError(400, 'id is required');

  if (body.action === 'approve') return handleApprove(body, id, supabase, admin);
  if (body.action === 'reject') return handleReject(body, id, supabase, admin);
  throw new HttpError(400, "action must be 'approve' or 'reject'");
}

async function handleDelete(request: Request, supabase: SupabaseClient) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new HttpError(400, 'id is required');

  const { error } = await supabase.from('account_requests').delete().eq('id', id);
  if (error) throw new HttpError(500, error.message);

  return json({ ok: true });
}

type Handler = (request: Request, supabase: SupabaseClient, admin: User) => Promise<Response>;

const withErrors = (handler: (request: Request) => Promise<Response>) => async (request: Request) => {
  try {
    return await handler(request);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error('account-requests error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
};

const withAdmin = (handler: Handler) =>
  withErrors(async (request) => {
    const supabase = getAdminClient();
    const admin = await authorize(request, supabase);
    return handler(request, supabase, admin);
  });

export const POST = withErrors(handleSubmit);
export const GET = withAdmin((request, supabase) => handleList(request, supabase));
export const PATCH = withAdmin(handleReview);
export const DELETE = withAdmin((request, supabase) => handleDelete(request, supabase));
