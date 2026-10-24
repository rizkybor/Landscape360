-- S.O.S alerts sent to the admin: who, message, full location, battery and times, plus the
-- location trail while the alert is active. Requires 20261024000014_sos_permission.sql.
--
-- The phone sends everything through sos_report(), keyed by a client id made on the phone
-- per S.O.S, so retries after lost signal update the same alert instead of adding new ones.
-- Only accounts with S.O.S access (and the admin) can send; the owner and the admin can read.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.sos_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  message TEXT CHECK (char_length(message) <= 500),
  lat DOUBLE PRECISION CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION CHECK (lng BETWEEN -180 AND 180),
  accuracy DOUBLE PRECISION,
  elevation DOUBLE PRECISION,
  battery SMALLINT CHECK (battery BETWEEN 0 AND 100),
  located_at TIMESTAMPTZ,              -- time of the last GPS fix
  started_at TIMESTAMPTZ NOT NULL,     -- when S.O.S was raised on the phone
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(), -- when it first reached the server
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_note TEXT CHECK (char_length(resolved_note) <= 500)
);

CREATE INDEX IF NOT EXISTS sos_alerts_status_idx ON public.sos_alerts (status, started_at DESC);
CREATE INDEX IF NOT EXISTS sos_alerts_user_idx ON public.sos_alerts (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.sos_alert_points (
  id BIGSERIAL PRIMARY KEY,
  alert_id UUID NOT NULL REFERENCES public.sos_alerts(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  elevation DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sos_alert_points_alert_idx ON public.sos_alert_points (alert_id, recorded_at);

ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alert_points ENABLE ROW LEVEL SECURITY;

-- Reading: the owner and the admin. Writing only through the functions below.
DROP POLICY IF EXISTS "Owner and admin read S.O.S alerts" ON public.sos_alerts;
CREATE POLICY "Owner and admin read S.O.S alerts" ON public.sos_alerts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Owner and admin read S.O.S points" ON public.sos_alert_points;
CREATE POLICY "Owner and admin read S.O.S points" ON public.sos_alert_points
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sos_alerts a
    WHERE a.id = alert_id AND (a.user_id = auth.uid() OR public.is_admin())
  ));

REVOKE INSERT, UPDATE, DELETE ON public.sos_alerts, public.sos_alert_points FROM anon, authenticated;
GRANT SELECT ON public.sos_alerts, public.sos_alert_points TO authenticated;

CREATE OR REPLACE FUNCTION public.can_use_sos()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (is_admin OR can_use_sos));
$$;

-- The phone reports an S.O.S: creates it the first time (per client id), then updates the
-- message, last location and status; every new location is also added to the trail.
-- p_status 'resolved' = the user pressed "I'm safe".
CREATE OR REPLACE FUNCTION public.sos_report(
  p_client_id UUID,
  p_started_at TIMESTAMPTZ,
  p_status TEXT DEFAULT 'active',
  p_message TEXT DEFAULT NULL,
  p_lat DOUBLE PRECISION DEFAULT NULL,
  p_lng DOUBLE PRECISION DEFAULT NULL,
  p_accuracy DOUBLE PRECISION DEFAULT NULL,
  p_elevation DOUBLE PRECISION DEFAULT NULL,
  p_battery SMALLINT DEFAULT NULL,
  p_located_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_owner UUID;
  v_status TEXT;
  v_last_lat DOUBLE PRECISION;
  v_last_lng DOUBLE PRECISION;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_use_sos() THEN
    RAISE EXCEPTION 'S.O.S is not enabled for this account';
  END IF;
  IF p_status NOT IN ('active', 'resolved') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT id, user_id, status, lat, lng INTO v_id, v_owner, v_status, v_last_lat, v_last_lng
  FROM public.sos_alerts WHERE client_id = p_client_id;

  IF v_id IS NULL THEN
    INSERT INTO public.sos_alerts (client_id, user_id, status, message, lat, lng, accuracy, elevation, battery, located_at, started_at, resolved_at)
    VALUES (p_client_id, auth.uid(), p_status, NULLIF(left(trim(p_message), 500), ''), p_lat, p_lng, p_accuracy, p_elevation, p_battery, p_located_at,
            LEAST(COALESCE(p_started_at, now()), now()), CASE WHEN p_status = 'resolved' THEN now() END)
    RETURNING id INTO v_id;
  ELSE
    IF v_owner <> auth.uid() THEN
      RAISE EXCEPTION 'Not your S.O.S';
    END IF;
    -- Once resolved (by the user or the admin) it stays resolved
    UPDATE public.sos_alerts SET
      message = COALESCE(NULLIF(left(trim(p_message), 500), ''), message),
      lat = COALESCE(p_lat, lat),
      lng = COALESCE(p_lng, lng),
      accuracy = COALESCE(p_accuracy, accuracy),
      elevation = COALESCE(p_elevation, elevation),
      battery = COALESCE(p_battery, battery),
      located_at = COALESCE(p_located_at, located_at),
      status = CASE WHEN status = 'resolved' THEN 'resolved' ELSE p_status END,
      resolved_at = CASE WHEN status = 'active' AND p_status = 'resolved' THEN now() ELSE resolved_at END,
      updated_at = now()
    WHERE id = v_id;
  END IF;

  IF p_lat IS NOT NULL AND p_lng IS NOT NULL
     AND (v_last_lat IS DISTINCT FROM p_lat OR v_last_lng IS DISTINCT FROM p_lng) THEN
    INSERT INTO public.sos_alert_points (alert_id, lat, lng, accuracy, elevation, recorded_at)
    VALUES (v_id, p_lat, p_lng, p_accuracy, p_elevation, COALESCE(p_located_at, now()));
  END IF;

  RETURN v_id;
END;
$$;

-- Admin: alerts with the account's name and contact details
CREATE OR REPLACE FUNCTION public.admin_sos_alerts(p_only_active BOOLEAN DEFAULT true, p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  name TEXT,
  phone TEXT,
  organization TEXT,
  status TEXT,
  message TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  elevation DOUBLE PRECISION,
  battery SMALLINT,
  located_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_note TEXT,
  point_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
  SELECT a.id, a.user_id, u.email::TEXT,
         COALESCE(NULLIF(u.raw_user_meta_data->>'display_name', ''), NULLIF(u.raw_user_meta_data->>'full_name', ''), u.raw_user_meta_data->>'name'),
         p.phone, p.organization,
         a.status, a.message, a.lat, a.lng, a.accuracy, a.elevation, a.battery,
         a.located_at, a.started_at, a.received_at, a.updated_at, a.resolved_at, a.resolved_note,
         (SELECT count(*) FROM public.sos_alert_points pt WHERE pt.alert_id = a.id)
  FROM public.sos_alerts a
  JOIN auth.users u ON u.id = a.user_id
  LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE NOT p_only_active OR a.status = 'active'
  ORDER BY (a.status = 'active') DESC, a.started_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200);
END;
$$;

-- Admin: close an alert (e.g. the person was found), with an optional note
CREATE OR REPLACE FUNCTION public.admin_resolve_sos(p_id UUID, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.sos_alerts
  SET status = 'resolved',
      resolved_at = COALESCE(resolved_at, now()),
      resolved_by = auth.uid(),
      resolved_note = NULLIF(left(trim(p_note), 500), ''),
      updated_at = now()
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.can_use_sos() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sos_report(UUID, TIMESTAMPTZ, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, SMALLINT, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_sos_alerts(BOOLEAN, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_resolve_sos(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_sos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sos_report(UUID, TIMESTAMPTZ, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, SMALLINT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_sos_alerts(BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_sos(UUID, TEXT) TO authenticated;
