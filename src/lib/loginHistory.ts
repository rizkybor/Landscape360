import { supabase } from './supabaseClient';

// Records a successful sign-in for the admin's login history (record_login() in
// 20261024000005_login_history.sql). Never blocks or fails the sign-in.
export const recordLogin = () => {
  const userAgent = typeof navigator === 'undefined' ? null : navigator.userAgent;
  supabase.rpc('record_login', { p_user_agent: userAgent }).then(
    () => undefined,
    () => undefined,
  );
};

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
