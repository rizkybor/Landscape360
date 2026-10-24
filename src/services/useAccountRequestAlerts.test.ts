import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAccountRequestAlerts } from './useAccountRequestAlerts';
import { fetchAccountRequestSummary } from '../lib/accountRequests';
import { supabase } from '../lib/supabaseClient';

vi.mock('../lib/accountRequests', () => ({ fetchAccountRequestSummary: vi.fn() }));
vi.mock('../lib/supabaseClient', () => ({
  supabase: { auth: { updateUser: vi.fn(() => Promise.resolve({ error: null })) } },
}));

describe('useAccountRequestAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchAccountRequestSummary).mockResolvedValue({ pendingCount: 5, newCount: 2 });
  });

  afterEach(() => vi.useRealTimers());

  it('counts requests that arrived since Account Requests was last opened', async () => {
    const seenAt = '2026-10-24T09:00:00.123456+00:00';
    const { result } = renderHook(() => useAccountRequestAlerts(true, seenAt));
    await waitFor(() => expect(result.current.newCount).toBe(2));
    expect(fetchAccountRequestSummary).toHaveBeenCalledWith(seenAt);
  });

  it('does nothing for non-admins', async () => {
    const { result } = renderHook(() => useAccountRequestAlerts(false, null));
    await act(async () => undefined);
    expect(result.current.newCount).toBe(0);
    expect(fetchAccountRequestSummary).not.toHaveBeenCalled();
  });

  it('checks again every minute', async () => {
    vi.useFakeTimers();
    renderHook(() => useAccountRequestAlerts(true, null));
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    expect(fetchAccountRequestSummary).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(fetchAccountRequestSummary).toHaveBeenCalledTimes(2);
  });

  it('clears the badge and saves the newest request time when opened', async () => {
    const { result } = renderHook(() => useAccountRequestAlerts(true, '2026-10-24T09:00:00+00:00'));
    await waitFor(() => expect(result.current.newCount).toBe(2));

    await act(() => result.current.markSeen('2026-10-24T10:30:00.654321+00:00'));
    expect(result.current.newCount).toBe(0);
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: { account_requests_seen_at: '2026-10-24T10:30:00.654321+00:00' },
    });
  });

  it('does not move the seen time backwards or save it without requests', async () => {
    const { result } = renderHook(() => useAccountRequestAlerts(true, '2026-10-24T09:00:00+00:00'));
    await waitFor(() => expect(result.current.newCount).toBe(2));
    await act(() => result.current.markSeen('2026-10-24T08:00:00+00:00'));
    await act(() => result.current.markSeen(null));
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
    expect(result.current.newCount).toBe(0);
  });
});
