-- Contours uploaded to a Marked Area (website only): contour lines from a SHP, GeoTIFF DEM,
-- GeoJSON, KML or KMZ file, cut to the area and stored as GeoJSON. Shown on the map with
-- the area and through its share link. Requires 20261026000019 (marked areas). Safe to re-run.
--
-- Pro, Enterprise and admin only (same rule as share links). One contour set per area,
-- counted toward cloud storage with marked locations and areas. 5 MB per set at most.

-- 1. Table --------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.marked_area_contours (
  area_id UUID PRIMARY KEY REFERENCES public.marked_areas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL CHECK (char_length(source_name) BETWEEN 1 AND 200),
  source_format TEXT NOT NULL CHECK (source_format IN ('shp', 'geotiff', 'geojson', 'kml', 'kmz')),
  interval_m DOUBLE PRECISION CHECK (interval_m IS NULL OR interval_m > 0),
  line_count INTEGER NOT NULL CHECK (line_count >= 0),
  min_elevation DOUBLE PRECISION,
  max_elevation DOUBLE PRECISION,
  -- GeoJSON FeatureCollection of LineStrings with an "elevation" property
  data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object' AND pg_column_size(data) <= 5242880),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marked_area_contours_user_idx ON public.marked_area_contours (user_id);

-- Owner of the area, plan allowed; ownership and the area never change
CREATE OR REPLACE FUNCTION public.check_marked_area_contours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id;
    NEW.area_id := OLD.area_id;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := now();
  END IF;
  IF NOT public.can_share_marked_locations() THEN
    RAISE EXCEPTION 'Contour upload is for Pro, Enterprise and admin accounts';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.marked_areas WHERE id = NEW.area_id AND user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'You can only add contours to your own areas';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marked_area_contours_check ON public.marked_area_contours;
CREATE TRIGGER marked_area_contours_check
  BEFORE INSERT OR UPDATE ON public.marked_area_contours
  FOR EACH ROW EXECUTE FUNCTION public.check_marked_area_contours();

-- 2. Row level security -------------------------------------------------------------------

ALTER TABLE public.marked_area_contours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own or (admin) all area contours" ON public.marked_area_contours;
DROP POLICY IF EXISTS "Insert own area contours" ON public.marked_area_contours;
DROP POLICY IF EXISTS "Update own area contours" ON public.marked_area_contours;
DROP POLICY IF EXISTS "Delete own or (admin) any area contours" ON public.marked_area_contours;

CREATE POLICY "View own or (admin) all area contours" ON public.marked_area_contours
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "Insert own area contours" ON public.marked_area_contours
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Update own area contours" ON public.marked_area_contours
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own or (admin) any area contours" ON public.marked_area_contours
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

-- 3. Cloud storage: contours count with marked locations and areas ---------------------

CREATE OR REPLACE FUNCTION public.storage_row_size_area_contours(p_name TEXT, p_data JSONB)
RETURNS BIGINT LANGUAGE sql IMMUTABLE AS $$
  SELECT 120 + COALESCE(pg_column_size(p_name), 0) + COALESCE(pg_column_size(p_data), 0);
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
        FROM public.marked_areas a WHERE a.user_id = p_user_id)
     + (SELECT COALESCE(SUM(public.storage_row_size_area_contours(c.source_name, c.data)), 0)
        FROM public.marked_area_contours c WHERE c.user_id = p_user_id))::BIGINT,
    (SELECT COALESCE(SUM(public.storage_row_size_survey(s.name, s.data)), 0)::BIGINT
       FROM public.surveys s WHERE s.user_id = p_user_id),
    (SELECT COALESCE(SUM(b.file_size), 0)::BIGINT
       FROM public.custom_basemaps b WHERE b.user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.enforce_storage_quota_area_contours()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_storage_quota(
    NEW.user_id,
    CASE WHEN TG_OP = 'UPDATE' THEN public.storage_row_size_area_contours(OLD.source_name, OLD.data) ELSE 0 END,
    public.storage_row_size_area_contours(NEW.source_name, NEW.data)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marked_area_contours_storage_quota ON public.marked_area_contours;
CREATE TRIGGER marked_area_contours_storage_quota
  BEFORE INSERT OR UPDATE ON public.marked_area_contours
  FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota_area_contours();

-- 4. Share links: the contours of a shared area, without sign-in --------------------------

CREATE OR REPLACE FUNCTION public.open_marked_area_link_contours(p_token TEXT)
RETURNS TABLE (data JSONB, interval_m DOUBLE PRECISION)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.data, c.interval_m
  FROM public.marked_area_links l
  JOIN public.marked_area_contours c ON c.area_id = l.area_id
  WHERE l.token = p_token AND l.revoked_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.check_marked_area_contours() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_storage_quota_area_contours() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.open_marked_area_link_contours(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_marked_area_link_contours(TEXT) TO anon, authenticated;
