-- Custom basemaps for every Enterprise account (Monitor and User roles), not only Enterprise
-- Monitors. Replaces the check from 20261024000006_security_hardening.sql; the upload rules
-- stay the same (own folder only, PNG up to 10 MB, counted in the storage quota). Safe to
-- re-run.

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
      AND (is_admin OR status_subscribe = 'Enterprise')
  );
$$;

REVOKE ALL ON FUNCTION public.can_upload_custom_basemaps() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_upload_custom_basemaps() TO authenticated;
