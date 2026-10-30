-- Classic (resection / intersection practice, website only): share a Field Work as a link
-- anyone can open to look at it, with or without an account. Every signed-in account can share.
-- The link always shows the latest version: the app saves each change to a shared Field Work
-- here. Field Works themselves stay in the owner's browser; only shared ones are stored.
-- Requires the helper account_display_name() (20261024000003). Safe to re-run.

-- 1. Table --------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.classic_field_work_links (
  token TEXT PRIMARY KEY CHECK (token ~ '^[0-9a-f]{32}$'),
  owner_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('resection', 'intersection')),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 40),
  -- { sightings, origin, lineLengths, declination } as the app keeps them
  data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object' AND pg_column_size(data) <= 262144),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS classic_field_work_links_owner_idx
  ON public.classic_field_work_links (owner_id) WHERE revoked_at IS NULL;

-- Written only through the functions below
ALTER TABLE public.classic_field_work_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their Field Work links" ON public.classic_field_work_links;
CREATE POLICY "Owners read their Field Work links" ON public.classic_field_work_links
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.classic_field_work_links FROM anon, authenticated;
GRANT SELECT ON public.classic_field_work_links TO authenticated;

-- 2. Share or update ----------------------------------------------------------------------

-- p_token NULL creates a link; a token of yours updates it (the link always shows the latest)
CREATE OR REPLACE FUNCTION public.save_classic_field_work_link(p_token TEXT, p_mode TEXT, p_name TEXT, p_data JSONB)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT := p_token;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to share a Field Work';
  END IF;

  IF v_token IS NOT NULL THEN
    UPDATE public.classic_field_work_links
    SET mode = p_mode, name = trim(p_name), data = p_data, updated_at = now()
    WHERE token = v_token AND owner_id = auth.uid() AND revoked_at IS NULL;
    IF FOUND THEN
      RETURN v_token;
    END IF;
    -- Not yours, or turned off: make a new link instead
  END IF;

  IF (SELECT count(*) FROM public.classic_field_work_links WHERE owner_id = auth.uid() AND revoked_at IS NULL) >= 100 THEN
    RAISE EXCEPTION 'You can share up to 100 Field Works. Stop sharing one first.';
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.classic_field_work_links (token, owner_id, mode, name, data)
  VALUES (v_token, auth.uid(), p_mode, trim(p_name), p_data);
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_classic_field_work_link(p_token TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.classic_field_work_links SET revoked_at = now()
  WHERE token = p_token AND owner_id = auth.uid() AND revoked_at IS NULL;
$$;

-- 3. Open (anyone with the link, no sign-in) ------------------------------------------------

CREATE OR REPLACE FUNCTION public.open_classic_field_work_link(p_token TEXT)
RETURNS TABLE (mode TEXT, name TEXT, data JSONB, updated_at TIMESTAMPTZ, owner_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT l.mode, l.name, l.data, l.updated_at, public.account_display_name(l.owner_id)
  FROM public.classic_field_work_links l
  WHERE l.token = p_token AND l.revoked_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.save_classic_field_work_link(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_classic_field_work_link(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_classic_field_work_link(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_classic_field_work_link(TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_classic_field_work_link(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_classic_field_work_link(TEXT) TO anon, authenticated;
