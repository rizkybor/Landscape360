-- Cloud storage quotas per plan (with per-account overrides), and Track Recorder renaming
-- for Pro accounts. Requires 20261024000001 (track sharing) and 20261024000003 (marked
-- locations). Safe to re-run.
--
-- Counted data: recorded tracks, marked locations, surveys and custom basemap files.
-- Sizes are the stored (compressed) sizes, so they are an estimate of the space used.
-- Defaults (admins can change them in Manage Users; keep in sync with src/lib/adminUsers.ts):
--   Free 10 MB · Pro 100 MB · Enterprise 1024 MB · Admin unlimited

-- 1. Track Recorder: Pro, Enterprise and admins may rename their own cloud tracks ----------

CREATE OR REPLACE FUNCTION public.rename_recorded_track(p_track_id UUID, p_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (is_admin OR status_subscribe IN ('Pro', 'Enterprise'))
  ) THEN
    RAISE EXCEPTION 'Renaming tracks needs a Pro or Enterprise plan';
  END IF;

  -- Only the name changes, so recording rules (points, stats) are untouched
  UPDATE public.recorded_tracks
  SET name = trim(p_name), updated_at = now()
  WHERE id = p_track_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Track not found or not yours';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_recorded_track(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_recorded_track(UUID, TEXT) TO authenticated;

-- 2. Limits -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.plan_storage_limits (
  plan TEXT PRIMARY KEY CHECK (plan IN ('Free', 'Pro', 'Enterprise')),
  limit_mb NUMERIC NOT NULL CHECK (limit_mb >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.plan_storage_limits (plan, limit_mb) VALUES
  ('Free', 10),
  ('Pro', 100),
  ('Enterprise', 1024)
ON CONFLICT (plan) DO NOTHING;

-- Everyone may read the plan limits; only the admin API (service role) changes them
ALTER TABLE public.plan_storage_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone signed in can read plan storage limits" ON public.plan_storage_limits;
CREATE POLICY "Anyone signed in can read plan storage limits"
ON public.plan_storage_limits FOR SELECT TO authenticated
USING (true);

-- Per-account override set by the admin; NULL = use the plan limit
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS storage_limit_mb NUMERIC CHECK (storage_limit_mb >= 0);

-- 3. Usage ------------------------------------------------------------------------------

-- Approximate stored size of one row; the same formulas are used when checking new data.
CREATE OR REPLACE FUNCTION public.storage_row_size_track(p_name TEXT, p_points JSONB)
RETURNS BIGINT LANGUAGE sql IMMUTABLE AS $$
  SELECT 256 + COALESCE(pg_column_size(p_name), 0) + COALESCE(pg_column_size(p_points), 0);
$$;

CREATE OR REPLACE FUNCTION public.storage_row_size_location(
  p_name TEXT, p_description TEXT, p_address TEXT, p_contact TEXT, p_tags TEXT[]
)
RETURNS BIGINT LANGUAGE sql IMMUTABLE AS $$
  SELECT 160 + COALESCE(pg_column_size(p_name), 0) + COALESCE(pg_column_size(p_description), 0)
             + COALESCE(pg_column_size(p_address), 0) + COALESCE(pg_column_size(p_contact), 0)
             + COALESCE(pg_column_size(p_tags), 0);
$$;

CREATE OR REPLACE FUNCTION public.storage_row_size_survey(p_name TEXT, p_data JSONB)
RETURNS BIGINT LANGUAGE sql IMMUTABLE AS $$
  SELECT 96 + COALESCE(pg_column_size(p_name), 0) + COALESCE(pg_column_size(p_data), 0);
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
    (SELECT COALESCE(SUM(public.storage_row_size_location(m.name, m.description, m.address, m.contact, m.tags)), 0)::BIGINT
       FROM public.marked_locations m WHERE m.user_id = p_user_id),
    (SELECT COALESCE(SUM(public.storage_row_size_survey(s.name, s.data)), 0)::BIGINT
       FROM public.surveys s WHERE s.user_id = p_user_id),
    (SELECT COALESCE(SUM(b.file_size), 0)::BIGINT
       FROM public.custom_basemaps b WHERE b.user_id = p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.storage_used_bytes(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tracks_bytes + locations_bytes + surveys_bytes + basemaps_bytes
  FROM public.storage_usage_breakdown(p_user_id);
$$;

-- Limit in bytes; NULL = unlimited (admins)
CREATE OR REPLACE FUNCTION public.storage_limit_bytes(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.is_admin THEN NULL
    ELSE (COALESCE(
      p.storage_limit_mb,
      (SELECT l.limit_mb FROM public.plan_storage_limits l WHERE l.plan = p.status_subscribe),
      (SELECT l.limit_mb FROM public.plan_storage_limits l WHERE l.plan = 'Free'),
      10
    ) * 1024 * 1024)::BIGINT
  END
  FROM (SELECT 1) AS one
  LEFT JOIN public.profiles p ON p.id = p_user_id;
$$;

-- 4. Enforcement ------------------------------------------------------------------------

-- Raises when growing a user's data from p_old_size to p_new_size would pass their limit.
-- Shrinking or deleting is always allowed so a full account can clean up.
CREATE OR REPLACE FUNCTION public.assert_storage_quota(p_user_id UUID, p_old_size BIGINT, p_new_size BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit BIGINT;
  v_used BIGINT;
  v_projected BIGINT;
BEGIN
  IF p_new_size <= p_old_size THEN
    RETURN;
  END IF;
  v_limit := public.storage_limit_bytes(p_user_id);
  IF v_limit IS NULL THEN
    RETURN;
  END IF;
  v_used := public.storage_used_bytes(p_user_id);
  v_projected := v_used - p_old_size + p_new_size;
  IF v_projected > v_limit THEN
    RAISE EXCEPTION 'Storage limit reached: % MB of % MB used and this needs % MB more. Delete some data or contact the admin for more space.',
      round(v_used / 1048576.0, 2), round(v_limit / 1048576.0, 2),
      GREATEST(round((p_new_size - p_old_size) / 1048576.0, 2), 0.01)
      USING ERRCODE = 'P0001', HINT = 'storage_quota';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_storage_quota_tracks()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_storage_quota(
    NEW.user_id,
    CASE WHEN TG_OP = 'UPDATE' THEN public.storage_row_size_track(OLD.name, OLD.points)
      -- upsert: BEFORE INSERT also runs when the row already exists
      ELSE COALESCE((SELECT public.storage_row_size_track(t.name, t.points)
                     FROM public.recorded_tracks t WHERE t.id = NEW.id AND t.user_id = NEW.user_id), 0) END,
    public.storage_row_size_track(NEW.name, NEW.points)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_storage_quota_locations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_storage_quota(
    NEW.user_id,
    CASE WHEN TG_OP = 'UPDATE'
      THEN public.storage_row_size_location(OLD.name, OLD.description, OLD.address, OLD.contact, OLD.tags)
      ELSE COALESCE((SELECT public.storage_row_size_location(m.name, m.description, m.address, m.contact, m.tags)
                     FROM public.marked_locations m WHERE m.id = NEW.id AND m.user_id = NEW.user_id), 0) END,
    public.storage_row_size_location(NEW.name, NEW.description, NEW.address, NEW.contact, NEW.tags)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_storage_quota_surveys()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_storage_quota(
    NEW.user_id,
    CASE WHEN TG_OP = 'UPDATE' THEN public.storage_row_size_survey(OLD.name, OLD.data)
      ELSE COALESCE((SELECT public.storage_row_size_survey(s.name, s.data)
                     FROM public.surveys s WHERE s.id = NEW.id AND s.user_id = NEW.user_id), 0) END,
    public.storage_row_size_survey(NEW.name, NEW.data)
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_storage_quota_basemaps()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_storage_quota(
    NEW.user_id,
    CASE WHEN TG_OP = 'UPDATE' THEN COALESCE(OLD.file_size, 0)
      ELSE COALESCE((SELECT b.file_size FROM public.custom_basemaps b
                     WHERE b.id = NEW.id AND b.user_id = NEW.user_id), 0) END,
    COALESCE(NEW.file_size, 0)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recorded_tracks_storage_quota ON public.recorded_tracks;
CREATE TRIGGER recorded_tracks_storage_quota
  BEFORE INSERT OR UPDATE ON public.recorded_tracks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota_tracks();

DROP TRIGGER IF EXISTS marked_locations_storage_quota ON public.marked_locations;
CREATE TRIGGER marked_locations_storage_quota
  BEFORE INSERT OR UPDATE ON public.marked_locations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota_locations();

DROP TRIGGER IF EXISTS surveys_storage_quota ON public.surveys;
CREATE TRIGGER surveys_storage_quota
  BEFORE INSERT OR UPDATE ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota_surveys();

DROP TRIGGER IF EXISTS custom_basemaps_storage_quota ON public.custom_basemaps;
CREATE TRIGGER custom_basemaps_storage_quota
  BEFORE INSERT OR UPDATE ON public.custom_basemaps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_storage_quota_basemaps();

-- 5. Reporting --------------------------------------------------------------------------

-- My own usage, for the account menu
CREATE OR REPLACE FUNCTION public.my_storage_usage()
RETURNS TABLE (
  tracks_bytes BIGINT,
  locations_bytes BIGINT,
  surveys_bytes BIGINT,
  basemaps_bytes BIGINT,
  used_bytes BIGINT,
  limit_bytes BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.tracks_bytes, b.locations_bytes, b.surveys_bytes, b.basemaps_bytes,
         b.tracks_bytes + b.locations_bytes + b.surveys_bytes + b.basemaps_bytes,
         public.storage_limit_bytes(auth.uid())
  FROM public.storage_usage_breakdown(auth.uid()) b
  WHERE auth.uid() IS NOT NULL;
$$;

-- Every account's usage, for the admin API (service role only)
CREATE OR REPLACE FUNCTION public.admin_storage_overview()
RETURNS TABLE (
  user_id UUID,
  tracks_bytes BIGINT,
  locations_bytes BIGINT,
  surveys_bytes BIGINT,
  basemaps_bytes BIGINT,
  used_bytes BIGINT,
  limit_bytes BIGINT,
  override_mb NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, b.tracks_bytes, b.locations_bytes, b.surveys_bytes, b.basemaps_bytes,
         b.tracks_bytes + b.locations_bytes + b.surveys_bytes + b.basemaps_bytes,
         public.storage_limit_bytes(p.id),
         p.storage_limit_mb
  FROM public.profiles p
  CROSS JOIN LATERAL public.storage_usage_breakdown(p.id) b;
$$;

REVOKE ALL ON FUNCTION public.storage_usage_breakdown(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.storage_used_bytes(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.storage_limit_bytes(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_storage_quota(UUID, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_storage_overview() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_storage_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_storage_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_storage_overview() TO service_role;
