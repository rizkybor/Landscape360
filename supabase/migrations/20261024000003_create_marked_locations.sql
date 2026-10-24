-- Marked Locations: saved places with full details, shareable with other accounts by
-- email or display name. Safe to re-run.
--
-- Plan rules (keep in sync with src/utils/markedLocations.ts):
--   Free        10 locations, cannot share (can still receive shares)
--   Pro         100 locations, can share
--   Enterprise  1000 locations, can share
--   Admin       unlimited, can share, and can view/edit/delete every account's locations

-- 1. Helpers -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin);
$$;

-- Max locations for an account; NULL means unlimited
CREATE OR REPLACE FUNCTION public.marked_location_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.is_admin THEN NULL
    WHEN p.status_subscribe = 'Enterprise' THEN 1000
    WHEN p.status_subscribe = 'Pro' THEN 100
    ELSE 10
  END
  FROM (SELECT 1) AS one
  LEFT JOIN public.profiles p ON p.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.can_share_marked_locations()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (is_admin OR status_subscribe IN ('Pro', 'Enterprise'))
  );
$$;

-- Display name from the auth metadata (admin panel writes display_name, the profile
-- editor writes full_name). Not callable from the client: used by the RPCs below only.
CREATE OR REPLACE FUNCTION public.account_display_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT NULLIF(trim(COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'display_name',
    u.raw_user_meta_data->>'name'
  )), '')
  FROM auth.users u
  WHERE u.id = p_user_id;
$$;

-- b***@gmail.com: enough to tell accounts apart without handing out addresses
CREATE OR REPLACE FUNCTION public.mask_email(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_email IS NULL OR position('@' IN p_email) < 2 THEN p_email
    ELSE left(p_email, 1) || '***' || substring(p_email FROM position('@' IN p_email))
  END;
$$;

-- 2. Tables ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.marked_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  category TEXT NOT NULL DEFAULT 'poi' CHECK (category IN (
    'poi', 'camp', 'summit', 'water', 'shelter', 'viewpoint', 'trailhead', 'hazard', 'cave', 'parking'
  )),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  elevation_m DOUBLE PRECISION,
  description TEXT CHECK (char_length(description) <= 2000),
  address TEXT CHECK (char_length(address) <= 200),
  contact TEXT CHECK (char_length(contact) <= 120),
  tags TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(tags) <= 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marked_locations_user_created_idx
  ON public.marked_locations (user_id, created_at DESC);

-- owner_id is stored so share policies never query marked_locations (that would make the
-- two tables' policies recurse)
CREATE TABLE IF NOT EXISTS public.marked_location_shares (
  location_id UUID NOT NULL REFERENCES public.marked_locations(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, shared_with),
  CHECK (owner_id <> shared_with)
);

CREATE INDEX IF NOT EXISTS marked_location_shares_shared_with_idx
  ON public.marked_location_shares (shared_with);

-- 3. Plan limit + updated_at ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_marked_location_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_count INTEGER := public.marked_location_limit(NEW.user_id);
  current_count INTEGER;
BEGIN
  IF max_count IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO current_count FROM public.marked_locations WHERE user_id = NEW.user_id;
  IF current_count >= max_count THEN
    RAISE EXCEPTION 'You have reached the maximum of % marked locations for your plan.', max_count;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marked_locations_limit ON public.marked_locations;
CREATE TRIGGER marked_locations_limit
  BEFORE INSERT ON public.marked_locations
  FOR EACH ROW EXECUTE FUNCTION public.check_marked_location_limit();

CREATE OR REPLACE FUNCTION public.touch_marked_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  NEW.user_id := OLD.user_id; -- ownership never changes
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marked_locations_touch ON public.marked_locations;
CREATE TRIGGER marked_locations_touch
  BEFORE UPDATE ON public.marked_locations
  FOR EACH ROW EXECUTE FUNCTION public.touch_marked_location();

-- 4. Row level security -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_marked_location_owner(p_location_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marked_locations WHERE id = p_location_id AND user_id = auth.uid()
  );
$$;

ALTER TABLE public.marked_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marked_location_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own, shared or (admin) all marked locations" ON public.marked_locations;
DROP POLICY IF EXISTS "Insert own marked locations" ON public.marked_locations;
DROP POLICY IF EXISTS "Update own or (admin) any marked location" ON public.marked_locations;
DROP POLICY IF EXISTS "Delete own or (admin) any marked location" ON public.marked_locations;

CREATE POLICY "View own, shared or (admin) all marked locations"
ON public.marked_locations FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.marked_location_shares s
    WHERE s.location_id = marked_locations.id AND s.shared_with = auth.uid()
  )
);

CREATE POLICY "Insert own marked locations"
ON public.marked_locations FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own or (admin) any marked location"
ON public.marked_locations FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_admin())
WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "Delete own or (admin) any marked location"
ON public.marked_locations FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Owners and recipients can view location shares" ON public.marked_location_shares;
DROP POLICY IF EXISTS "Owners and recipients can remove location shares" ON public.marked_location_shares;

CREATE POLICY "Owners and recipients can view location shares"
ON public.marked_location_shares FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR shared_with = auth.uid());

-- Owner revokes access, or the recipient removes the location from their list.
-- New shares are only created through share_marked_locations().
CREATE POLICY "Owners and recipients can remove location shares"
ON public.marked_location_shares FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR shared_with = auth.uid());

-- 5. RPCs --------------------------------------------------------------------------------

-- Share one or more of my locations with an account, found by exact email or exact
-- display name (case-insensitive). A name used by several accounts must be shared by email.
CREATE OR REPLACE FUNCTION public.share_marked_locations(p_location_ids UUID[], p_recipient TEXT)
RETURNS TABLE (shared_with UUID, name TEXT, email_masked TEXT, shared_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
DECLARE
  v_query TEXT := lower(trim(p_recipient));
  v_matches UUID[];
  v_recipient UUID;
  v_count INTEGER;
BEGIN
  IF NOT public.can_share_marked_locations() THEN
    RAISE EXCEPTION 'Your plan does not allow sharing locations';
  END IF;
  IF p_location_ids IS NULL OR cardinality(p_location_ids) = 0 THEN
    RAISE EXCEPTION 'Select at least one location to share';
  END IF;
  IF cardinality(p_location_ids) > 500 THEN
    RAISE EXCEPTION 'You can share at most 500 locations at once';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_location_ids) AS l(id)
    WHERE NOT public.is_marked_location_owner(l.id)
  ) THEN
    RAISE EXCEPTION 'You can only share your own locations';
  END IF;
  IF v_query IS NULL OR v_query = '' THEN
    RAISE EXCEPTION 'Enter the recipient''s email or name';
  END IF;

  IF position('@' IN v_query) > 0 THEN
    SELECT array_agg(p.id) INTO v_matches FROM public.profiles p WHERE lower(p.email) = v_query;
  ELSE
    SELECT array_agg(u.id) INTO v_matches
    FROM auth.users u
    WHERE lower(trim(u.raw_user_meta_data->>'full_name')) = v_query
       OR lower(trim(u.raw_user_meta_data->>'display_name')) = v_query
       OR lower(trim(u.raw_user_meta_data->>'name')) = v_query;
  END IF;

  IF v_matches IS NULL OR cardinality(v_matches) = 0 THEN
    RAISE EXCEPTION 'No Landscape360 account found for "%"', trim(p_recipient);
  END IF;
  IF cardinality(v_matches) > 1 THEN
    RAISE EXCEPTION 'Several accounts use the name "%". Share by email instead.', trim(p_recipient);
  END IF;

  v_recipient := v_matches[1];
  IF v_recipient = auth.uid() THEN
    RAISE EXCEPTION 'You cannot share with yourself';
  END IF;

  INSERT INTO public.marked_location_shares (location_id, owner_id, shared_with)
  SELECT DISTINCT l.id, auth.uid(), v_recipient FROM unnest(p_location_ids) AS l(id)
  ON CONFLICT (location_id, shared_with) DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY
  SELECT v_recipient,
         public.account_display_name(v_recipient),
         public.mask_email(p.email),
         v_count
  FROM public.profiles p
  WHERE p.id = v_recipient;
END;
$$;

-- Recipients of one of my locations
CREATE OR REPLACE FUNCTION public.list_marked_location_shares(p_location_id UUID)
RETURNS TABLE (shared_with UUID, name TEXT, email_masked TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.shared_with,
         public.account_display_name(s.shared_with),
         public.mask_email(p.email),
         s.created_at
  FROM public.marked_location_shares s
  LEFT JOIN public.profiles p ON p.id = s.shared_with
  WHERE s.location_id = p_location_id AND s.owner_id = auth.uid()
  ORDER BY s.created_at;
$$;

-- Locations shared with me, with who shared them
CREATE OR REPLACE FUNCTION public.list_marked_locations_shared_with_me()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  category TEXT,
  lng DOUBLE PRECISION,
  lat DOUBLE PRECISION,
  elevation_m DOUBLE PRECISION,
  description TEXT,
  address TEXT,
  contact TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  owner_name TEXT,
  owner_email_masked TEXT,
  shared_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.user_id, m.name, m.category, m.lng, m.lat, m.elevation_m, m.description,
         m.address, m.contact, m.tags, m.created_at, m.updated_at,
         public.account_display_name(m.user_id),
         public.mask_email(p.email),
         s.created_at
  FROM public.marked_location_shares s
  JOIN public.marked_locations m ON m.id = s.location_id
  LEFT JOIN public.profiles p ON p.id = m.user_id
  WHERE s.shared_with = auth.uid()
  ORDER BY s.created_at DESC;
$$;

-- Admin: every account's locations with the owner's details
CREATE OR REPLACE FUNCTION public.admin_list_marked_locations()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  category TEXT,
  lng DOUBLE PRECISION,
  lat DOUBLE PRECISION,
  elevation_m DOUBLE PRECISION,
  description TEXT,
  address TEXT,
  contact TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  owner_name TEXT,
  owner_email TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
  SELECT m.id, m.user_id, m.name, m.category, m.lng, m.lat, m.elevation_m, m.description,
         m.address, m.contact, m.tags, m.created_at, m.updated_at,
         public.account_display_name(m.user_id),
         p.email
  FROM public.marked_locations m
  LEFT JOIN public.profiles p ON p.id = m.user_id
  ORDER BY m.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.account_display_name(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.marked_location_limit(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.share_marked_locations(UUID[], TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_marked_location_shares(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_marked_locations_shared_with_me() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_marked_locations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_marked_locations(UUID[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_marked_location_shares(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_marked_locations_shared_with_me() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_marked_locations() TO authenticated;
