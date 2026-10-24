import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchAccountRequestSummary } from '../lib/accountRequests';

const POLL_MS = 60_000;
export const SEEN_AT_KEY = 'account_requests_seen_at';

// Admin notification for new account requests. "New" = pending requests created after the
// admin last opened Account Requests; that moment is kept in the admin's auth metadata so it
// is the same on every device.
export const useAccountRequestAlerts = (enabled: boolean, seenAt: string | null) => {
  const [newCount, setNewCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
    try {
      const summary = await fetchAccountRequestSummary(seenAt);
      setNewCount(summary.newCount);
    } catch {
      // Keep the last known count (offline, API not deployed yet...)
    }
  }, [enabled, seenAt]);

  useEffect(() => {
    if (!enabled) return;
    const first = setTimeout(refresh, 0);
    const id = setInterval(refresh, POLL_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled, refresh]);

  // Called when Account Requests is opened; `latest` is the newest request it loaded
  const markSeen = useCallback(
    async (latest: string | null) => {
      setNewCount(0);
      if (!latest || (seenAt && Date.parse(latest) <= Date.parse(seenAt))) return;
      const { error } = await supabase.auth.updateUser({ data: { [SEEN_AT_KEY]: latest } });
      if (error) console.warn('Could not save account request seen time:', error.message);
    },
    [seenAt],
  );

  // A count from a previous admin session never shows for a non-admin
  return { newCount: enabled ? newCount : 0, refresh, markSeen };
};
