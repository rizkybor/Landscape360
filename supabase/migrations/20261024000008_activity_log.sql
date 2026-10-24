-- Sign-outs for the admin's activity feed (User Account modal). Login history now stores
-- both sign-ins and sign-outs in login_events, told apart by the event column. Requires
-- 20261024000005_login_history.sql. Safe to re-run.

ALTER TABLE public.login_events
  ADD COLUMN IF NOT EXISTS event TEXT NOT NULL DEFAULT 'login'
  CHECK (event IN ('login', 'logout'));

-- The activity feed reads the latest events of all accounts
CREATE INDEX IF NOT EXISTS login_events_created_idx
  ON public.login_events (created_at DESC);

-- Shared by record_login() and record_logout(): ignores a repeat of the same event within
-- a minute and keeps the latest 200 events per account.
CREATE OR REPLACE FUNCTION public.record_auth_event(p_event TEXT, p_user_agent TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_event NOT IN ('login', 'logout') THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.login_events
    WHERE user_id = auth.uid() AND event = p_event AND created_at > now() - interval '1 minute'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.login_events (user_id, user_agent, event)
  VALUES (auth.uid(), left(p_user_agent, 400), p_event);

  DELETE FROM public.login_events
  WHERE user_id = auth.uid()
    AND id NOT IN (
      SELECT id FROM public.login_events
      WHERE user_id = auth.uid()
      ORDER BY created_at DESC
      LIMIT 200
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_auth_event(TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_login(p_user_agent TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.record_auth_event('login', p_user_agent) $$;

CREATE OR REPLACE FUNCTION public.record_logout(p_user_agent TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.record_auth_event('logout', p_user_agent) $$;

REVOKE ALL ON FUNCTION public.record_login(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_login(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.record_logout(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_logout(TEXT) TO authenticated;
