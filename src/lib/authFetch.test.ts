import { describe, it, expect, vi, beforeEach } from 'vitest';

const getSession = vi.fn();
const refreshSession = vi.fn();
vi.mock('./supabaseClient', () => ({ supabase: { auth: { getSession: () => getSession(), refreshSession: () => refreshSession() } } }));

import { authFetch, SESSION_ENDED_MESSAGE } from './authFetch';

const fetchMock = vi.fn();
const res = (status: number) => new Response('{}', { status });
const tokenOf = (call: unknown[]) => ((call[1] as RequestInit).headers as Record<string, string>).Authorization;

describe('authFetch', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    refreshSession.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    getSession.mockResolvedValue({ data: { session: { access_token: 'old' } } });
  });

  it('sends the access token', async () => {
    fetchMock.mockResolvedValue(res(200));
    expect((await authFetch('/api/x', { method: 'GET' })).status).toBe(200);
    expect(tokenOf(fetchMock.mock.calls[0])).toBe('Bearer old');
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes an ended session once and retries', async () => {
    fetchMock.mockResolvedValueOnce(res(401)).mockResolvedValueOnce(res(200));
    refreshSession.mockResolvedValue({ data: { session: { access_token: 'new' } }, error: null });
    expect((await authFetch('/api/x')).status).toBe(200);
    expect(tokenOf(fetchMock.mock.calls[1])).toBe('Bearer new');
  });

  it('asks to sign in again when the session cannot be refreshed', async () => {
    fetchMock.mockResolvedValue(res(401));
    refreshSession.mockResolvedValue({ data: { session: null }, error: new Error('Refresh Token Not Found') });
    await expect(authFetch('/api/x')).rejects.toThrow(SESSION_ENDED_MESSAGE);
  });

  it('does not refresh for other errors', async () => {
    fetchMock.mockResolvedValue(res(403));
    expect((await authFetch('/api/x')).status).toBe(403);
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
