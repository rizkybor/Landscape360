CREATE OR REPLACE FUNCTION public.is_monitor()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND status_user = 'monitor360'
      AND status_subscribe = 'Enterprise'
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.tracker_activity_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  distance_m DOUBLE PRECISION NOT NULL DEFAULT 0,
  point_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tracker_activity_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own activity sessions" ON public.tracker_activity_sessions;
DROP POLICY IF EXISTS "Users can view own activity sessions" ON public.tracker_activity_sessions;
DROP POLICY IF EXISTS "Users can update own activity sessions" ON public.tracker_activity_sessions;
DROP POLICY IF EXISTS "Monitors can view all activity sessions" ON public.tracker_activity_sessions;

CREATE POLICY "Users can insert own activity sessions"
ON public.tracker_activity_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own activity sessions"
ON public.tracker_activity_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own activity sessions"
ON public.tracker_activity_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Monitors can view all activity sessions"
ON public.tracker_activity_sessions
FOR SELECT
TO authenticated
USING (public.is_monitor());

ALTER TABLE public.tracker_logs
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.tracker_activity_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tracker_logs_session_timestamp
ON public.tracker_logs (session_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_tracker_activity_sessions_user_started
ON public.tracker_activity_sessions (user_id, started_at DESC);

CREATE OR REPLACE FUNCTION get_tracker_activity_sessions(
  p_user_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  session_id UUID,
  user_id UUID,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  distance_m DOUBLE PRECISION,
  point_count BIGINT,
  last_point_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL AND NOT public.is_monitor() THEN
    p_user_id := auth.uid();
  END IF;

  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.user_id,
    s.started_at,
    s.ended_at,
    s.distance_m,
    COUNT(t.id) AS point_count,
    MAX(t.timestamp) AS last_point_at
  FROM public.tracker_activity_sessions s
  LEFT JOIN public.tracker_logs t
    ON t.session_id = s.id
  WHERE (p_user_id IS NULL OR s.user_id = p_user_id)
    AND (public.is_monitor() OR s.user_id = auth.uid())
  GROUP BY s.id, s.user_id, s.started_at, s.ended_at, s.distance_m
  ORDER BY s.started_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

