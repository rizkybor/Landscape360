import { authFetch } from './authFetch';

// Keep in sync with api/admin-users.ts
export const PLANS = ['Free', 'Pro', 'Enterprise'] as const;
export const ROLES = ['pengguna360', 'monitor360'] as const;
export const MIN_PASSWORD_LENGTH = 8;

export type Plan = (typeof PLANS)[number];
export type Role = (typeof ROLES)[number];

export interface StorageBreakdown {
  tracks: number;
  locations: number;
  surveys: number;
  basemaps: number;
}

export interface UserStorage {
  usedBytes: number;
  limitBytes: number | null; // null = unlimited (admin)
  overrideMb: number | null; // custom quota set by the admin; null = plan limit
  breakdown: StorageBreakdown;
}

export interface ManagedUser {
  id: string;
  email: string;
  displayName: string | null;
  organization: string | null; // from the account request (null before the contact migration)
  phone: string | null;
  plan: Plan;
  role: Role;
  isAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  storage: UserStorage | null; // null until the storage migration has been run
  canUseSos: boolean; // S.O.S button access (always true for the admin)
}

export type PlanStorageLimits = Record<Plan, number>; // MB

export interface NewUserInput {
  email: string;
  password: string;
  displayName?: string;
  plan: Plan;
  role: Role;
  canUseSos?: boolean;
}

export interface UserUpdateInput {
  id: string;
  plan?: Plan;
  role?: Role;
  password?: string;
  displayName?: string;
  storageLimitMb?: number | null; // null = back to the plan limit
  canUseSos?: boolean;
}

const ENDPOINT = '/api/admin-users';

async function request<T>(method: string, body?: unknown, query = ''): Promise<T> {
  const res = await authFetch(`${ENDPOINT}${query}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  // A non-JSON 200 means the dev server answered with index.html: the Vercel Function is not running
  if (payload === null) {
    throw new Error('Admin API is not available here. Use the deployed site or run `vercel dev`.');
  }
  return payload as T;
}

export const listUsers = () =>
  request<{ users: ManagedUser[]; planStorageLimits: PlanStorageLimits | null }>('GET');

export interface LoginEvent {
  id: number;
  userAgent: string | null;
  signedInAt: string;
}

// available = false until the login history migration has been run
export const fetchLoginHistory = (userId: string) =>
  request<{ logins: LoginEvent[]; available: boolean }>(
    'GET',
    undefined,
    `?loginHistory=${encodeURIComponent(userId)}`,
  );

export type ActivityType = 'login' | 'logout' | 'request';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  email: string | null;
  name: string | null; // requester's name (account requests only)
  detail: string | null; // user agent for sign-ins/outs, "<plan> · <status>" for requests
  at: string;
}

// Each flag is false until the matching migration has been run
export interface ActivityAvailability {
  logins: boolean;
  logouts: boolean;
  requests: boolean;
}

export const ACTIVITY_PAGE_SIZE = 10;

// One page of activity, newest first. `before` = time of the oldest entry already shown,
// to load the next (older) page.
export const fetchActivity = ({ before, type }: { before?: string; type?: ActivityType } = {}) => {
  const params = new URLSearchParams({ activity: '1', limit: String(ACTIVITY_PAGE_SIZE) });
  if (before) params.set('before', before);
  if (type) params.set('type', type);
  return request<{ activity: ActivityEvent[]; hasMore: boolean; available: ActivityAvailability }>(
    'GET',
    undefined,
    `?${params.toString()}`,
  );
};

export const updatePlanStorageLimits =(planStorageLimits: Partial<PlanStorageLimits>) =>
  request<{ ok: true }>('PUT', { planStorageLimits });

export const createUser = (input: NewUserInput) =>
  request<{ id: string }>('POST', input);

export const updateUser = (input: UserUpdateInput) =>
  request<{ ok: true }>('PATCH', input);

export const deleteUser = (id: string) =>
  request<{ ok: true }>('DELETE', undefined, `?id=${encodeURIComponent(id)}`);
