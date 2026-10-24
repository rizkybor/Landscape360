import { supabase } from './supabaseClient';

const userAgent = () => (typeof navigator === 'undefined' ? null : navigator.userAgent);

// Records a successful sign-in for the admin's login history (record_login() in
// 20261024000005_login_history.sql). Never blocks or fails the sign-in.
export const recordLogin = () => {
  supabase.rpc('record_login', { p_user_agent: userAgent() }).then(
    () => undefined,
    () => undefined,
  );
};

// Records a sign-out for the admin's activity feed (record_logout() in
// 20261024000008_activity_log.sql). Must run before signOut() while the session is still
// valid; waits at most 2 s and never fails the sign-out.
export const recordLogout = () =>
  Promise.race([
    supabase.rpc('record_logout', { p_user_agent: userAgent() }).then(
      () => undefined,
      () => undefined,
    ),
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]);

// "Chrome on Android", "Safari on iPhone"... good enough to tell devices apart
export const describeUserAgent = (ua: string | null): string => {
  if (!ua) return 'Unknown device';

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS/.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS/.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Browser';

  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Unknown OS';

  return `${browser} on ${os}`;
};

// "just now", "5 min ago", "3 h ago", "2 d ago"
export const timeAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} d ago` : `${Math.round(days / 30)} mo ago`;
};
