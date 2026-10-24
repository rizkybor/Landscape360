-- Security hardening. Safe to re-run.
--
-- 1. Custom basemap uploads: only Enterprise Monitor accounts and the admin may upload, only
--    into their own folder (<user id>/...), only PNG files up to 10 MB. Before this, any
--    signed-in account could upload any file of any size anywhere in the bucket, outside the
--    storage quota.
-- 2. SECURITY DEFINER functions get a fixed search_path so they cannot be tricked into
--    running objects from another schema (Supabase Security Advisor: function_search_path_mutable).

-- 1. Storage ----------------------------------------------------------------------------

UPDATE storage.buckets
SET public = false,
    file_size_limit = 10485760, -- 10 MB; the app keeps each account under 5 MB in total
    allowed_mime_types = ARRAY['image/png']
WHERE id = 'custom-basemaps';

CREATE OR REPLACE FUNCTION public.can_upload_custom_basemaps()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (is_admin OR (status_subscribe = 'Enterprise' AND status_user = 'monitor360'))
  );
$$;

REVOKE ALL ON FUNCTION public.can_upload_custom_basemaps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_upload_custom_basemaps() TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can upload basemaps" ON storage.objects;
DROP POLICY IF EXISTS "Eligible users can upload basemaps to own folder" ON storage.objects;

CREATE POLICY "Eligible users can upload basemaps to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'custom-basemaps'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND public.can_upload_custom_basemaps()
);

-- custom_basemaps rows follow the same rule (reading and deleting own rows stays open so
-- data is not stranded after a plan change)
DROP POLICY IF EXISTS "Users can insert own basemaps" ON public.custom_basemaps;
CREATE POLICY "Users can insert own basemaps"
ON public.custom_basemaps FOR INSERT
WITH CHECK (auth.uid() = user_id AND public.can_upload_custom_basemaps());

DROP POLICY IF EXISTS "Users can update own basemaps" ON public.custom_basemaps;
CREATE POLICY "Users can update own basemaps"
ON public.custom_basemaps FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 2. search_path on older SECURITY DEFINER functions ------------------------------------

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname IN ('is_monitor', 'handle_new_user', 'get_tracker_sessions', 'get_tracker_activity_sessions')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn.signature);
  END LOOP;
END;
$$;
