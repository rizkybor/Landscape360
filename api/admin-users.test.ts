import { describe, it, expect, vi, beforeEach } from 'vitest';

// Fake Supabase for the admin activity feed
let loginEventsHasEventColumn: boolean;

const LOGIN_EVENTS = [
  { id: 2, user_id: 'u1', user_agent: 'UA', created_at: '2026-10-24T10:05:00Z', event: 'logout' },
  { id: 1, user_id: 'u1', user_agent: 'UA', created_at: '2026-10-24T10:00:00Z', event: 'login' },
];
const REQUESTS = [
  { id: 'r1', email: 'budi@x.com', full_name: 'Budi', requested_plan: 'Pro', status: 'pending', created_at: '2026-10-24T10:02:00Z' },
];

const result = (table: string, columns: string) => {
  if (table === 'profiles') return { data: [{ id: 'u1', email: 'pro@x.com', is_admin: true }], error: null };
  if (table === 'account_requests') return { data: REQUESTS, error: null };
  if (columns.includes('event') && !loginEventsHasEventColumn) {
    return { data: null, error: { code: '42703', message: 'column login_events.event does not exist' } };
  }
  return {
    data: LOGIN_EVENTS.map(({ event, ...row }) => (columns.includes('event') ? { ...row, event } : row)),
    error: null,
  };
};

const builder = (table: string) => {
  let columns = '';
  const chain: Record<string, unknown> = {};
  for (const m of ['eq', 'in', 'order', 'limit']) chain[m] = () => chain;
  chain.select = (c: string) => {
    columns = c;
    return chain;
  };
  chain.maybeSingle = () => Promise.resolve({ data: { is_admin: true }, error: null });
  chain.then = (resolve: (r: unknown) => unknown) => Promise.resolve(result(table, columns)).then(resolve);
  return chain;
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: builder,
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));

process.env.SUPABASE_URL = 'https://x.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
const { GET } = await import('./admin-users');

const getActivity = async () => {
  const res = await GET(new Request('https://x/api/admin-users?activity=1', { headers: { Authorization: 'Bearer t' } }));
  return { status: res.status, body: await res.json() };
};

describe('GET /api/admin-users?activity=1', () => {
  beforeEach(() => {
    loginEventsHasEventColumn = true;
  });

  it('merges sign-ins, sign-outs and account requests newest first', async () => {
    const { status, body } = await getActivity();
    expect(status).toBe(200);
    expect(body.available).toEqual({ logins: true, logouts: true, requests: true });
    expect(body.activity.map((e: { type: string; email: string }) => [e.type, e.email])).toEqual([
      ['logout', 'pro@x.com'],
      ['request', 'budi@x.com'],
      ['login', 'pro@x.com'],
    ]);
    expect(body.activity[1]).toMatchObject({ name: 'Budi', detail: 'Pro · pending' });
  });

  it('treats every event as a sign-in before the activity log migration', async () => {
    loginEventsHasEventColumn = false;
    const { body } = await getActivity();
    expect(body.available).toEqual({ logins: true, logouts: false, requests: true });
    expect(body.activity.filter((e: { type: string }) => e.type === 'login')).toHaveLength(2);
  });
});
