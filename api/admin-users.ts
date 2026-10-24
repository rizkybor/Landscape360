/**
 * Admin user management (Vercel Function).
 *
 * Only accounts with profiles.is_admin = true may call these endpoints. Requests
 * must send the caller's Supabase access token as `Authorization: Bearer <token>`.
 *
 *   GET    /api/admin-users           -> list users with plan, role & storage usage, plus plan storage limits
 *   GET    /api/admin-users?loginHistory=<uuid> -> latest sign-ins of one user (time & browser)
 *   GET    /api/admin-users?activity=1[&before=<iso>][&type=login|logout|request][&limit=n]
 *                                     -> a page of sign-ins, sign-outs and account requests, newest first
 *   POST   /api/admin-users           -> create user { email, password, displayName?, plan, role }
 *   PATCH  /api/admin-users           -> update user { id, plan?, role?, password?, displayName?, storageLimitMb? }
 *                                        (storageLimitMb: number = custom quota, null = back to the plan limit)
 *   PUT    /api/admin-users           -> set plan storage limits { planStorageLimits: { Free?, Pro?, Enterprise? } } (MB)
 *   DELETE /api/admin-users?id=<uuid> -> delete user
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL (or VITE_SUPABASE_URL)
 * in the Vercel project environment variables.
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

// Keep in sync with src/lib/adminUsers.ts
const PLANS = ['Free', 'Pro', 'Enterprise'];
const ROLES = ['pengguna360', 'monitor360'];
const MIN_PASSWORD_LENGTH = 8;
const MAX_STORAGE_LIMIT_MB = 1_000_000;
// PostgREST / Postgres codes for a function or table that does not exist yet
const MISSING_OBJECT_CODES = ['PGRST202', 'PGRST205', '42883', '42P01'];
// Postgres code for a column that does not exist yet (login_events.event before 20261024000008)
const MISSING_COLUMN_CODE = '42703';
const ACTIVITY_PAGE_SIZE = 20;
const ACTIVITY_MAX_PAGE_SIZE = 100;

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

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be a string`);
  return value.trim();
}

function validatePlan(plan: string | undefined) {
  if (plan !== undefined && !PLANS.includes(plan)) {
    throw new HttpError(400, `plan must be one of ${PLANS.join(', ')}`);
  }
}

function validateRole(role: string | undefined) {
  if (role !== undefined && !ROLES.includes(role)) {
    throw new HttpError(400, `role must be one of ${ROLES.join(', ')}`);
  }
}

function validatePassword(password: string | undefined) {
  if (password !== undefined && password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpError(400, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
}

function validateStorageLimit(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_STORAGE_LIMIT_MB) {
    throw new HttpError(400, `${field} must be a number of MB between 0 and ${MAX_STORAGE_LIMIT_MB}`);
  }
  return Math.round(value * 100) / 100;
}

interface StorageRow {
  user_id: string;
  tracks_bytes: number;
  locations_bytes: number;
  surveys_bytes: number;
  basemaps_bytes: number;
  used_bytes: number;
  limit_bytes: number | null;
  override_mb: number | null;
}

// Storage usage per user, or null while the storage migration has not been run yet
async function loadStorage(supabase: SupabaseClient) {
  const [overview, limits] = await Promise.all([
    supabase.rpc('admin_storage_overview'),
    supabase.from('plan_storage_limits').select('plan, limit_mb'),
  ]);
  const error = overview.error ?? limits.error;
  if (error) {
    if (MISSING_OBJECT_CODES.includes(error.code ?? '')) return null;
    throw new HttpError(500, error.message);
  }
  return {
    byUser: new Map(((overview.data ?? []) as StorageRow[]).map((row) => [row.user_id, row])),
    planLimits: Object.fromEntries(
      ((limits.data ?? []) as { plan: string; limit_mb: number }[]).map((l) => [l.plan, Number(l.limit_mb)]),
    ),
  };
}

async function listAllUsers(supabase: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new HttpError(500, error.message);
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }
  return users;
}

async function handleList(supabase: SupabaseClient) {
  const [users, profilesResult, storage] = await Promise.all([
    listAllUsers(supabase),
    supabase.from('profiles').select('id, status_subscribe, status_user, is_admin'),
    loadStorage(supabase),
  ]);
  const { data: profiles, error } = profilesResult;
  if (error) throw new HttpError(500, error.message);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]));

  const result = users
    .map((u) => {
      const profile = profileMap.get(u.id);
      const usage = storage?.byUser.get(u.id);
      return {
        id: u.id,
        email: u.email ?? '',
        displayName: (u.user_metadata?.display_name as string | undefined) ?? null,
        plan: profile?.status_subscribe ?? 'Free',
        role: profile?.status_user ?? 'pengguna360',
        isAdmin: profile?.is_admin === true,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        storage: usage
          ? {
              usedBytes: Number(usage.used_bytes),
              limitBytes: usage.limit_bytes === null ? null : Number(usage.limit_bytes),
              overrideMb: usage.override_mb === null ? null : Number(usage.override_mb),
              breakdown: {
                tracks: Number(usage.tracks_bytes),
                locations: Number(usage.locations_bytes),
                surveys: Number(usage.surveys_bytes),
                basemaps: Number(usage.basemaps_bytes),
              },
            }
          : null,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));

  return json({ users: result, planStorageLimits: storage?.planLimits ?? null });
}

async function handleLoginHistory(supabase: SupabaseClient, userId: string) {
  const query = (onlyLogins: boolean) => {
    const q = supabase.from('login_events').select('id, user_agent, created_at').eq('user_id', userId);
    return (onlyLogins ? q.eq('event', 'login') : q).order('created_at', { ascending: false }).limit(30);
  };
  let { data, error } = await query(true);
  // Before the activity log migration every event is a sign-in
  if (error?.code === MISSING_COLUMN_CODE) ({ data, error } = await query(false));
  if (error) {
    // Login history migration not run yet
    if (MISSING_OBJECT_CODES.includes(error.code ?? '')) return json({ logins: [], available: false });
    throw new HttpError(500, error.message);
  }
  return json({
    available: true,
    logins: (data ?? []).map((e) => ({ id: e.id, userAgent: e.user_agent, signedInAt: e.created_at })),
  });
}

interface LoginEventRow {
  id: number;
  user_id: string;
  user_agent: string | null;
  created_at: string;
  event?: 'login' | 'logout';
}

const ACTIVITY_TYPES = ['login', 'logout', 'request'];

// Sign-ins, sign-outs and account requests of all users, newest first, one page at a time.
// `before` (ISO time of the last entry already shown) loads the next, older page; `type`
// keeps one kind of entry. `hasMore` says whether an older page exists.
async function handleActivity(supabase: SupabaseClient, params: URLSearchParams) {
  const beforeParam = params.get('before');
  const before = beforeParam && !Number.isNaN(Date.parse(beforeParam)) ? new Date(beforeParam).toISOString() : null;
  if (beforeParam && !before) throw new HttpError(400, 'before must be an ISO date');
  const limit = Math.min(Math.max(Number(params.get('limit')) || ACTIVITY_PAGE_SIZE, 1), ACTIVITY_MAX_PAGE_SIZE);
  const type = params.get('type');
  if (type && !ACTIVITY_TYPES.includes(type)) throw new HttpError(400, `type must be one of ${ACTIVITY_TYPES.join(', ')}`);

  const wantEvents = type !== 'request';
  const wantRequests = !type || type === 'request';
  // One extra row per source tells whether an older page exists
  const fetchSize = limit + 1;

  const loginEvents = (withEvent: boolean) => {
    let q = supabase
      .from('login_events')
      .select(withEvent ? 'id, user_id, user_agent, created_at, event' : 'id, user_id, user_agent, created_at');
    if (withEvent && (type === 'login' || type === 'logout')) q = q.eq('event', type);
    if (before) q = q.lt('created_at', before);
    return q.order('created_at', { ascending: false }).limit(fetchSize);
  };
  const accountRequests = () => {
    let q = supabase.from('account_requests').select('id, email, full_name, requested_plan, status, created_at');
    if (before) q = q.lt('created_at', before);
    return q.order('created_at', { ascending: false }).limit(fetchSize);
  };
  const none = Promise.resolve({ data: [], error: null });

  const [eventsResult, requestsResult] = await Promise.all([
    wantEvents ? loginEvents(true) : none,
    wantRequests ? accountRequests() : none,
  ]);

  let events = eventsResult;
  const hasEventColumn = events.error?.code !== MISSING_COLUMN_CODE;
  // Before the activity log migration every event is a sign-in, and there are no sign-outs
  if (!hasEventColumn) events = type === 'logout' ? { data: [], error: null } : await loginEvents(false);
  const eventsMissing = MISSING_OBJECT_CODES.includes(events.error?.code ?? '');
  const requestsMissing = MISSING_OBJECT_CODES.includes(requestsResult.error?.code ?? '');
  if (events.error && !eventsMissing) throw new HttpError(500, events.error.message);
  if (requestsResult.error && !requestsMissing) throw new HttpError(500, requestsResult.error.message);

  const eventRows = (eventsMissing ? [] : (events.data ?? [])) as unknown as LoginEventRow[];
  const requestRows = (requestsMissing ? [] : (requestsResult.data ?? [])) as {
    id: string;
    email: string;
    full_name: string;
    requested_plan: string;
    status: string;
    created_at: string;
  }[];

  const userIds = [...new Set(eventRows.map((e) => e.user_id))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase.from('profiles').select('id, email').in('id', userIds)
    : { data: [], error: null };
  if (profilesError) throw new HttpError(500, profilesError.message);
  const emailOf = new Map((profiles ?? []).map((p) => [p.id, p.email as string | null]));

  const merged = [
    ...eventRows.map((e) => ({
      id: `${e.event ?? 'login'}-${e.id}`,
      type: e.event ?? 'login',
      email: emailOf.get(e.user_id) ?? null,
      name: null,
      detail: e.user_agent,
      at: e.created_at,
    })),
    ...requestRows.map((r) => ({
      id: `request-${r.id}`,
      type: 'request',
      email: r.email,
      name: r.full_name,
      detail: `${r.requested_plan} · ${r.status}`,
      at: r.created_at,
    })),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  return json({
    activity: merged.slice(0, limit),
    hasMore: merged.length > limit,
    available: { logins: !eventsMissing, logouts: !eventsMissing && hasEventColumn, requests: !requestsMissing },
  });
}

async function handlePlanLimits(request: Request, supabase: SupabaseClient) {
  const body = await readBody(request);
  const limits = body.planStorageLimits;
  if (!limits || typeof limits !== 'object') throw new HttpError(400, 'planStorageLimits is required');

  const rows = Object.entries(limits as Record<string, unknown>).map(([plan, value]) => {
    if (!PLANS.includes(plan)) throw new HttpError(400, `plan must be one of ${PLANS.join(', ')}`);
    return { plan, limit_mb: validateStorageLimit(value, `${plan} limit`), updated_at: new Date().toISOString() };
  });
  if (rows.length === 0) throw new HttpError(400, 'planStorageLimits is empty');

  const { error } = await supabase.from('plan_storage_limits').upsert(rows, { onConflict: 'plan' });
  if (error) throw new HttpError(500, error.message);

  return json({ ok: true });
}

async function handleCreate(request: Request, supabase: SupabaseClient) {
  const body = await readBody(request);
  const email = optionalString(body.email, 'email')?.toLowerCase();
  const password = optionalString(body.password, 'password');
  const displayName = optionalString(body.displayName, 'displayName');
  const plan = optionalString(body.plan, 'plan') ?? 'Free';
  const role = optionalString(body.role, 'role') ?? 'pengguna360';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'A valid email is required');
  }
  if (!password) throw new HttpError(400, 'Password is required');
  validatePassword(password);
  validatePlan(plan);
  validateRole(role);

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName ?? email.split('@')[0] },
  });
  if (error || !data.user) throw new HttpError(400, error?.message ?? 'Failed to create user');

  // The signup trigger may already have inserted a Free profile; upsert overrides it
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      { id: data.user.id, email, status_subscribe: plan, status_user: role },
      { onConflict: 'id' },
    );
  if (profileError) {
    throw new HttpError(500, `User created but profile update failed: ${profileError.message}`);
  }

  return json({ id: data.user.id }, 201);
}

async function handleUpdate(request: Request, supabase: SupabaseClient, admin: User) {
  const body = await readBody(request);
  const id = optionalString(body.id, 'id');
  const plan = optionalString(body.plan, 'plan');
  const role = optionalString(body.role, 'role');
  const password = optionalString(body.password, 'password');
  const displayName = optionalString(body.displayName, 'displayName');

  if (!id) throw new HttpError(400, 'id is required');
  validatePlan(plan);
  validateRole(role);
  validatePassword(password);
  const hasStorageLimit = 'storageLimitMb' in body;
  const storageLimitMb =
    !hasStorageLimit || body.storageLimitMb === null
      ? null
      : validateStorageLimit(body.storageLimitMb, 'storageLimitMb');

  if (plan !== undefined || role !== undefined || hasStorageLimit) {
    const { data: target, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new HttpError(500, error.message);
    if (target?.is_admin || id === admin.id) {
      throw new HttpError(400, 'Admin accounts have full access; plan, role and storage limits do not apply');
    }
  }

  if (password !== undefined || displayName !== undefined) {
    const { error } = await supabase.auth.admin.updateUserById(id, {
      ...(password !== undefined && { password }),
      ...(displayName !== undefined && { user_metadata: { display_name: displayName } }),
    });
    if (error) throw new HttpError(400, error.message);
  }

  if (plan !== undefined || role !== undefined || hasStorageLimit) {
    const { error } = await supabase
      .from('profiles')
      .update({
        ...(plan !== undefined && { status_subscribe: plan }),
        ...(role !== undefined && { status_user: role }),
        ...(hasStorageLimit && { storage_limit_mb: storageLimitMb }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw new HttpError(400, error.message);
  }

  return json({ ok: true });
}

async function handleDelete(request: Request, supabase: SupabaseClient, admin: User) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new HttpError(400, 'id is required');
  if (id === admin.id) throw new HttpError(400, 'You cannot delete your own admin account');

  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) throw new HttpError(400, error.message);

  return json({ ok: true });
}

type Handler = (request: Request, supabase: SupabaseClient, admin: User) => Promise<Response>;

const withAdmin = (handler: Handler) => async (request: Request) => {
  try {
    const supabase = getAdminClient();
    const admin = await authorize(request, supabase);
    return await handler(request, supabase, admin);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error('admin-users error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
};

export const GET = withAdmin((request, supabase) => {
  const params = new URL(request.url).searchParams;
  const loginHistory = params.get('loginHistory');
  if (loginHistory) return handleLoginHistory(supabase, loginHistory);
  return params.has('activity') ? handleActivity(supabase, params) : handleList(supabase);
});
export const POST = withAdmin((request, supabase) => handleCreate(request, supabase));
export const PATCH = withAdmin(handleUpdate);
export const PUT = withAdmin((request, supabase) => handlePlanLimits(request, supabase));
export const DELETE = withAdmin(handleDelete);
