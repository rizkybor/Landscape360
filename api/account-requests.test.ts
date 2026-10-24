import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Fake Supabase for the public submit endpoint: no recent requests, no existing account
let inserts: unknown[];

const builder = (table: string) => {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'gte', 'ilike', 'limit']) chain[m] = () => chain;
  chain.insert = (row: unknown) => {
    inserts.push(row);
    return Promise.resolve({ error: null });
  };
  chain.then = (resolve: (r: unknown) => unknown) =>
    Promise.resolve(table === 'account_requests' ? { count: 0, error: null } : { data: [], error: null }).then(resolve);
  return chain;
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: builder }),
}));

const { POST } = await import('./account-requests');

const submit = (body: Record<string, unknown>) =>
  POST(
    new Request('https://x/api/account-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

const valid = {
  email: 'Budi@Example.com',
  fullName: 'Budi Santoso',
  organization: 'Makopala UBL',
  phone: '+62 812-3456-7890',
  message: 'Untuk pendakian',
  requestedPlan: 'Free',
};

describe('POST /api/account-requests', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://db');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'secret');
    inserts = [];
  });

  afterEach(() => vi.unstubAllEnvs());

  it('stores a complete Free request', async () => {
    const res = await submit(valid);
    expect(res.status).toBe(201);
    expect(inserts).toEqual([
      {
        email: 'budi@example.com',
        full_name: 'Budi Santoso',
        organization: 'Makopala UBL',
        phone: '+62 812-3456-7890',
        requested_plan: 'Free',
        message: 'Untuk pendakian',
      },
    ]);
  });

  it.each(['message', 'fullName', 'email'])('requires %s', async (field) => {
    const res = await submit({ ...valid, [field]: '  ' });
    expect(res.status).toBe(400);
    expect(inserts).toEqual([]);
  });

  it('accepts a request without organization or phone', async () => {
    const res = await submit({ ...valid, organization: '', phone: '' });
    expect(res.status).toBe(201);
    expect(inserts).toEqual([expect.objectContaining({ organization: null, phone: null })]);
  });

  it.each(['0812', '+6281234567890123', 'call me maybe'])('rejects the phone number %s', async (phone) => {
    const res = await submit({ ...valid, phone });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/8 to 15 digits/);
  });

  it.each(['Pro', 'Enterprise'])('does not accept a %s request', async (requestedPlan) => {
    const res = await submit({ ...valid, requestedPlan });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('New accounts can only request the Free plan');
    expect(inserts).toEqual([]);
  });
});
