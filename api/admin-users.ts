/**
 * Admin user management (Vercel Function).
 *
 * Only accounts with profiles.is_admin = true may call these endpoints. Requests
 * must send the caller's Supabase access token as `Authorization: Bearer <token>`.
 *
 *   GET    /api/admin-users           -> list users with plan & role
 *   POST   /api/admin-users           -> create user { email, password, displayName?, plan, role }
 *   PATCH  /api/admin-users           -> update user { id, plan?, role?, password?, displayName? }
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
  const users = await listAllUsers(supabase);

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, status_subscribe, status_user, is_admin');
  if (error) throw new HttpError(500, error.message);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]));

  const result = users
    .map((u) => {
      const profile = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? '',
        displayName: (u.user_metadata?.display_name as string | undefined) ?? null,
        plan: profile?.status_subscribe ?? 'Free',
        role: profile?.status_user ?? 'pengguna360',
        isAdmin: profile?.is_admin === true,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));

  return json({ users: result });
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

  if (plan !== undefined || role !== undefined) {
    const { data: target, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new HttpError(500, error.message);
    if (target?.is_admin || id === admin.id) {
      throw new HttpError(400, 'Admin accounts have full access; plan and role do not apply');
    }
  }

  if (password !== undefined || displayName !== undefined) {
    const { error } = await supabase.auth.admin.updateUserById(id, {
      ...(password !== undefined && { password }),
      ...(displayName !== undefined && { user_metadata: { display_name: displayName } }),
    });
    if (error) throw new HttpError(400, error.message);
  }

  if (plan !== undefined || role !== undefined) {
    const { error } = await supabase
      .from('profiles')
      .update({
        ...(plan !== undefined && { status_subscribe: plan }),
        ...(role !== undefined && { status_user: role }),
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

export const GET = withAdmin((_request, supabase) => handleList(supabase));
export const POST = withAdmin((request, supabase) => handleCreate(request, supabase));
export const PATCH = withAdmin(handleUpdate);
export const DELETE = withAdmin(handleDelete);
