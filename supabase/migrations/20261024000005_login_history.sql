-- Login history per account for Manage Users. Only the admin API (service role) reads it:
-- RLS is enabled with no policies, so the browser cannot read it. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.login_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_agent TEXT CHECK (char_length(user_agent) <= 400),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_events_user_created_idx
  ON public.login_events (user_id, created_at DESC);

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_events FROM anon, authenticated;

-- Called by the app right after a successful sign-in. Ignores repeats within a minute and
-- keeps the latest 100 events per account.
CREATE OR REPLACE FUNCTION public.record_login(p_user_agent TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.login_events
    WHERE user_id = auth.uid() AND created_at > now() - interval '1 minute'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.login_events (user_id, user_agent)
  VALUES (auth.uid(), left(p_user_agent, 400));

  DELETE FROM public.login_events
  WHERE user_id = auth.uid()
    AND id NOT IN (
      SELECT id FROM public.login_events
      WHERE user_id = auth.uid()
      ORDER BY created_at DESC
      LIMIT 100
    );
END;
$$;

REVOKE ALL ON FUNCTION public.record_login(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_login(TEXT) TO authenticated;
