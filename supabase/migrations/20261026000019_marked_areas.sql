-- Marked Areas: polygons drawn on the map (a camp ground, a route zone, a search sector),
-- with a focus view that darkens everything outside the area, and share links that open
-- the area without signing in. Requires 20261024000003 (marked locations) and
-- 20261024000004 (storage quotas). Safe to re-run.
--
-- Limits: Free 5 areas, Pro 10, Enterprise 20, admin unlimited. Every signed-in account can
-- make areas; share links are for Pro, Enterprise and admin (same rule as marked locations).
-- Areas count toward cloud storage, shown together with marked locations.

-- 1. Table --------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.marked_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  color TEXT NOT NULL DEFAULT '#d49b22' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  notes TEXT CHECK (char_length(notes) <= 2000),
  -- Outer ring as [[lng, lat], ...], not closed (the first point is not repeated)
  ring JSONB NOT NULL CHECK (jsonb_typeof(ring) = 'array' AND jsonb_array_length(ring) BETWEEN 3 AND 500),
  area_m2 DOUBLE PRECISION NOT NULL CHECK (area_m2 >= 0),
  perimeter_m DOUBLE PRECISION NOT NULL CHECK (perimeter_m >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marked_areas_user_created_idx ON public.marked_areas (user_id, created_at DESC);

-- 2. Plan limit + updated_at ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.marked_area_limit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.is_admin THEN NULL
    WHEN p.status_subscribe = 'Enterprise' THEN 20
    WHEN p.status_subscribe = 'Pro' THEN 10
    ELSE 5
  END
  FROM (SELECT 1) AS one
  LEFT JOIN public.profiles p ON p.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.check_marked_area_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_count INTEGER := public.marked_area_limit(NEW.user_id);
  current_count INTEGER;
BEGIN
  IF max_count IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO current_count FROM public.marked_areas WHERE user_id = NEW.user_id;
  IF current_count >= max_count THEN
    RAISE EXCEPTION 'You have reached the maximum of % marked areas for your plan.', max_count;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marked_areas_limit ON public.marked_areas;
CREATE TRIGGER marked_areas_limit
  BEFORE INSERT ON public.marked_areas
  FOR EACH ROW EXECUTE FUNCTION public.check_marked_area_limit();

CREATE OR REPLACE FUNCTION public.touch_marked_area()
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

DROP TRIGGER IF EXISTS marked_areas_touch ON public.marked_areas;
CREATE TRIGGER marked_areas_touch
  BEFORE UPDATE ON public.marked_areas
  FOR EACH ROW EXECUTE FUNCTION public.touch_marked_area();

-- 3. Row level security -------------------------------------------------------------------

ALTER TABLE public.marked_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own or (admin) all marked areas" ON public.marked_areas;
DROP POLICY IF EXISTS "Insert own marked areas" ON public.marked_areas;
DROP POLICY IF EXISTS "Update own or (admin) any marked area" ON public.marked_areas;
DROP POLICY IF EXISTS "Delete own or (admin) any marked area" ON public.marked_areas;

CREATE POLICY "View own or (admin) all marked areas" ON public.marked_areas
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Insert own marked areas" ON public.marked_areas
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own or (admin) any marked area" ON public.marked_areas
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Delete own or (admin) any marked area" ON public.marked_areas
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- 4. Cloud storage: areas count with marked locations ----------------------------------

CREATE OR REPLACE FUNCTION public.storage_row_size_area(p_name TEXT, p_notes TEXT, p_ring JSONB)
RETURNS BIGINT LANGUAGE sql IMMUTABLE AS $$
  SELECT 160 + COALESCE(pg_column_size(p_name), 0) + COALESCE(pg_column_size(p_notes), 0)
             + COALESCE(pg_column_size(p_ring), 0);
$$;

CREATE OR REPLACE FUNCTION public.storage_usage_breakdown(p_user_id UUID)
RETURNS TABLE (tracks_bytes BIGINT, locations_bytes BIGINT, surveys_bytes BIGINT, basemaps_bytes BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COALESCE(SUM(public.storage_row_size_track(t.name, t.points)), 0)::BIGINT
       FROM public.recorded_tracks t WHERE t.user_id = p_user_id),
    ((SELECT COALESCE(SUM(public.storage_row_size_location(m.name, m.description, m.address, m.contact, m.tags)), 0)
        FROM public.marked_locations m WHERE m.user_id = p_user_id)
     + (SELECT COALESCE(SUM(public.storage_row_size_area(a.name, a.notes, a.ring)), 0)
        FROM public.marked_areas a WHERE a.user_id = p_user_id))::BIGINT,
    (SELECT COALESCE(SUM(public.storage_row_size_survey(s.name, s.data)), 0)::BIGINT
       FROM public.surveys s WHERE s.user_id = p_user_id),
    (SELECT COALESCE(SUM(b.file_size), 0)::BIGINT
       FROM public.custom_basemaps b WHERE b.user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.enforce_storage_quota_areas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_storage_quota(
    NEW.user_id,
    CASE WHEN TG_OP = 'UPDATE' THEN public.storage_row_size_area(OLD.name, OLD.notes, OLD.ring) ELSE 0 END,
    public.storage_row_size_area(NEW.name, NEW.notes, NEW.ring)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marked_areas_storage_quota ON public.marked_areas;
CREATE TRIGGER marked_areas_storage_quota
  BEFORE INSERT OR UPDATE ON public.marked_areas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota_areas();

-- 5. Share links (anyone with the link can open the area, no sign-in) -------------------

CREATE TABLE IF NOT EXISTS public.marked_area_links (
  token TEXT PRIMARY KEY CHECK (token ~ '^[0-9a-f]{32}$'),
  area_id UUID NOT NULL REFERENCES public.marked_areas(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS marked_area_links_area_idx
  ON public.marked_area_links (area_id) WHERE revoked_at IS NULL;

ALTER TABLE public.marked_area_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their area links" ON public.marked_area_links;
CREATE POLICY "Owners read their area links" ON public.marked_area_links
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.marked_area_links FROM anon, authenticated;
GRANT SELECT ON public.marked_area_links TO authenticated;

CREATE OR REPLACE FUNCTION public.create_marked_area_link(p_area_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  IF NOT public.can_share_marked_locations() THEN
    RAISE EXCEPTION 'Your plan does not allow sharing areas';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marked_areas WHERE id = p_area_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You can only share your own areas';
  END IF;

  SELECT token INTO v_token FROM public.marked_area_links
  WHERE area_id = p_area_id AND revoked_at IS NULL
  ORDER BY created_at DESC LIMIT 1;

  IF v_token IS NULL THEN
    v_token := replace(gen_random_uuid()::text, '-', '');
    INSERT INTO public.marked_area_links (token, area_id, owner_id) VALUES (v_token, p_area_id, auth.uid());
  END IF;
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_marked_area_link(p_area_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT token FROM public.marked_area_links
  WHERE area_id = p_area_id AND owner_id = auth.uid() AND revoked_at IS NULL
  ORDER BY created_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.revoke_marked_area_link(p_area_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.marked_area_links SET revoked_at = now()
  WHERE area_id = p_area_id AND owner_id = auth.uid() AND revoked_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.open_marked_area_link(p_token TEXT)
RETURNS TABLE (
  name TEXT,
  color TEXT,
  notes TEXT,
  ring JSONB,
  area_m2 DOUBLE PRECISION,
  perimeter_m DOUBLE PRECISION,
  updated_at TIMESTAMPTZ,
  owner_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.name, a.color, a.notes, a.ring, a.area_m2, a.perimeter_m, a.updated_at,
         public.account_display_name(a.user_id)
  FROM public.marked_area_links l
  JOIN public.marked_areas a ON a.id = l.area_id
  WHERE l.token = p_token AND l.revoked_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.marked_area_limit(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_marked_area_link(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_marked_area_link(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_marked_area_link(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_marked_area_link(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_marked_area_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_marked_area_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_marked_area_link(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_marked_area_link(TEXT) TO anon, authenticated;
