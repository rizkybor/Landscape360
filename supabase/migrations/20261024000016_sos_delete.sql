-- Admin: delete an S.O.S alert from the history (its location trail is deleted with it).
-- Only resolved alerts, so an emergency still in progress cannot be removed by mistake.
-- Requires 20261024000015_sos_alerts.sql. Safe to re-run.

CREATE OR REPLACE FUNCTION public.admin_delete_sos(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sos_alerts WHERE id = p_id AND status = 'active') THEN
    RAISE EXCEPTION 'Resolve the S.O.S before deleting it';
  END IF;
  DELETE FROM public.sos_alerts WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_sos(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_sos(UUID) TO authenticated;
