import { supabase } from './supabaseClient';

export const SESSION_ENDED_MESSAGE = 'Your session has ended. Please sign out and sign in again.';

/**
 * fetch with the signed-in user's access token. The token kept in the browser can be
 * refused by the server although it looks valid here: the session was ended elsewhere
 * (signed out on another device, password changed), the phone slept past its expiry, or the
 * device clock is off. On a 401 the session is refreshed once and the request retried.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string) =>
    fetch(input, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  const res = await send(session.access_token);
  if (res.status !== 401) return res;

  const { data, error } = await supabase.auth.refreshSession();
  if (error || !data.session) throw new Error(SESSION_ENDED_MESSAGE);
  const retry = await send(data.session.access_token);
  if (retry.status === 401) throw new Error(SESSION_ENDED_MESSAGE);
  return retry;
}
