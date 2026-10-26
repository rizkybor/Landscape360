-- Share a marked location as a link (e.g. sent on WhatsApp): whoever has the link can see
-- that one location on the map without signing in. Requires 20261024000003 (marked locations).
--
-- The link carries a random 32-character token (122 bits, from gen_random_uuid), so it
-- cannot be guessed; only people who received it can open it. The owner can turn the link
-- off at any time, and it stops working when the location is deleted. Opening a link shows
-- the location and the owner's display name only (never their email). Same plan rule as
-- sharing with accounts: Pro, Enterprise and admin can create links. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.marked_location_links (
  token TEXT PRIMARY KEY CHECK (token ~ '^[0-9a-f]{32}$'),
  location_id UUID NOT NULL REFERENCES public.marked_locations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS marked_location_links_location_idx
  ON public.marked_location_links (location_id) WHERE revoked_at IS NULL;

ALTER TABLE public.marked_location_links ENABLE ROW LEVEL SECURITY;

-- Owners can see their own links; everything else goes through the functions below
DROP POLICY IF EXISTS "Owners read their location links" ON public.marked_location_links;
CREATE POLICY "Owners read their location links" ON public.marked_location_links
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.marked_location_links FROM anon, authenticated;
GRANT SELECT ON public.marked_location_links TO authenticated;

-- Owner: the link of one of my locations (the current one, or a new one). Returns the token.
CREATE OR REPLACE FUNCTION public.create_marked_location_link(p_location_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  IF NOT public.can_share_marked_locations() THEN
    RAISE EXCEPTION 'Your plan does not allow sharing locations';
  END IF;
  IF NOT public.is_marked_location_owner(p_location_id) THEN
    RAISE EXCEPTION 'You can only share your own locations';
  END IF;

  SELECT token INTO v_token
  FROM public.marked_location_links
  WHERE location_id = p_location_id AND revoked_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_token IS NULL THEN
    v_token := replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.marked_location_links (token, location_id, owner_id)
    VALUES (v_token, p_location_id, auth.uid());
  END IF;
  RETURN v_token;
END;
$$;

-- Owner: the active link of one of my locations, or NULL
CREATE OR REPLACE FUNCTION public.get_marked_location_link(p_location_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT token FROM public.marked_location_links
  WHERE location_id = p_location_id AND owner_id = auth.uid() AND revoked_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- Owner: turn the link off (people who have it can no longer open it)
CREATE OR REPLACE FUNCTION public.revoke_marked_location_link(p_location_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.marked_location_links
  SET revoked_at = now()
  WHERE location_id = p_location_id AND owner_id = auth.uid() AND revoked_at IS NULL;
$$;

-- Anyone with the link (signed in or not): the location it points to, or nothing
CREATE OR REPLACE FUNCTION public.open_marked_location_link(p_token TEXT)
RETURNS TABLE (
  name TEXT,
  category TEXT,
  lng DOUBLE PRECISION,
  lat DOUBLE PRECISION,
  elevation_m DOUBLE PRECISION,
  description TEXT,
  address TEXT,
  contact TEXT,
  tags TEXT[],
  updated_at TIMESTAMPTZ,
  owner_name TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.name, m.category, m.lng, m.lat, m.elevation_m, m.description, m.address,
         m.contact, m.tags, m.updated_at, public.account_display_name(m.user_id)
  FROM public.marked_location_links l
  JOIN public.marked_locations m ON m.id = l.location_id
  WHERE l.token = p_token AND l.revoked_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.create_marked_location_link(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_marked_location_link(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_marked_location_link(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_marked_location_link(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_marked_location_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marked_location_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_marked_location_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_marked_location_link(TEXT) TO anon, authenticated;
