import { supabase } from './supabaseClient';

// Keep in sync with api/admin-users.ts
export const PLANS = ['Free', 'Pro', 'Enterprise'] as const;
export const ROLES = ['pengguna360', 'monitor360'] as const;
export const MIN_PASSWORD_LENGTH = 8;

export type Plan = (typeof PLANS)[number];
export type Role = (typeof ROLES)[number];

export interface ManagedUser {
  id: string;
  email: string;
  displayName: string | null;
  plan: Plan;
  role: Role;
  isAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface NewUserInput {
  email: string;
  password: string;
  displayName?: string;
  plan: Plan;
  role: Role;
}

export interface UserUpdateInput {
  id: string;
  plan?: Plan;
  role?: Role;
  password?: string;
  displayName?: string;
}

const ENDPOINT = '/api/admin-users';

async function request<T>(method: string, body?: unknown, query = ''): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const res = await fetch(`${ENDPOINT}${query}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  return payload as T;
}

export const listUsers = async () =>
  (await request<{ users: ManagedUser[] }>('GET')).users;

export const createUser = (input: NewUserInput) =>
  request<{ id: string }>('POST', input);

export const updateUser = (input: UserUpdateInput) =>
  request<{ ok: true }>('PATCH', input);

export const deleteUser = (id: string) =>
  request<{ ok: true }>('DELETE', undefined, `?id=${encodeURIComponent(id)}`);
