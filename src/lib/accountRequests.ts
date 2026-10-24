import { supabase } from './supabaseClient';
import type { Plan, Role } from './adminUsers';

// Keep in sync with api/account-requests.ts
export const REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface AccountRequest {
  id: string;
  email: string;
  fullName: string;
  organization: string | null;
  phone: string | null;
  requestedPlan: Plan;
  message: string | null;
  status: RequestStatus;
  adminNote: string | null;
  userId: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface NewAccountRequestInput {
  email: string;
  fullName: string;
  organization: string;
  phone: string;
  requestedPlan: 'Free'; // visitors can only request Free; the admin picks the plan on approval
  message: string;
  website?: string; // honeypot, always empty for real visitors
}

export interface ApproveRequestInput {
  id: string;
  password: string;
  plan: Plan;
  role: Role;
  displayName?: string;
}

const ENDPOINT = '/api/account-requests';

async function request<T>(method: string, body?: unknown, query = '', auth = true): Promise<T> {
  const headers: Record<string, string> = {};
  if (auth) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not signed in');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${ENDPOINT}${query}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error || `Request failed (${res.status})`);
  }
  // A non-JSON 200 means the dev server answered with index.html: the Vercel Function is not running
  if (payload === null) {
    throw new Error('Account request API is not available here. Use the deployed site or run `vercel dev`.');
  }
  return payload as T;
}

export const submitAccountRequest = (input: NewAccountRequestInput) =>
  request<{ ok: true }>('POST', input, '', false);

export const listAccountRequests = (status: RequestStatus | 'all' = 'pending') =>
  request<{ requests: AccountRequest[]; pendingCount: number }>(
    'GET',
    undefined,
    `?status=${encodeURIComponent(status)}`,
  );

// `since`: when the admin last opened Account Requests (newCount = pending requests after it)
export const fetchAccountRequestSummary = (since: string | null) =>
  request<{ pendingCount: number; newCount: number }>(
    'GET',
    undefined,
    `?summary${since ? `&since=${encodeURIComponent(since)}` : ''}`,
  );

// Newest createdAt in a list, as returned by the server (keeps microseconds for `since`)
export const latestCreatedAt = (requests: AccountRequest[]): string | null =>
  requests.reduce<string | null>(
    (latest, r) => (latest === null || Date.parse(r.createdAt) > Date.parse(latest) ? r.createdAt : latest),
    null,
  );

export const approveAccountRequest =(input: ApproveRequestInput) =>
  request<{ ok: true; userId: string }>('PATCH', { action: 'approve', ...input });

export const rejectAccountRequest = (id: string, note?: string) =>
  request<{ ok: true }>('PATCH', { action: 'reject', id, note });

export const deleteAccountRequest = (id: string) =>
  request<{ ok: true }>('DELETE', undefined, `?id=${encodeURIComponent(id)}`);

// Readable random password for approved accounts (no 0/O/1/l/I look-alikes)
export function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join('');
}
