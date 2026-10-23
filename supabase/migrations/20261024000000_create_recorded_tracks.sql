-- Track Recorder: cloud copy of personal GPS tracks (see TrackRecorder.md).
-- Only Pro, Enterprise and admin accounts may create or update tracks; everyone keeps
-- read/delete access to their own tracks so data is not lost after a plan change.

CREATE OR REPLACE FUNCTION public.can_use_track_recorder()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (is_admin OR status_subscribe IN ('Pro', 'Enterprise'))
  );
$$;

CREATE TABLE IF NOT EXISTS public.recorded_tracks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  mode TEXT NOT NULL CHECK (mode IN ('online', 'offline')),
  status TEXT NOT NULL CHECK (status IN ('recording', 'paused', 'completed')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  elapsed_ms BIGINT NOT NULL DEFAULT 0,
  distance_m DOUBLE PRECISION NOT NULL DEFAULT 0,
  moving_time_ms BIGINT NOT NULL DEFAULT 0,
  elevation_gain_m DOUBLE PRECISION NOT NULL DEFAULT 0,
  elevation_loss_m DOUBLE PRECISION NOT NULL DEFAULT 0,
  max_alt_m DOUBLE PRECISION,
  min_alt_m DOUBLE PRECISION,
  point_count INTEGER NOT NULL DEFAULT 0,
  -- [[lng, lat, alt, timestamp_ms, accuracy_m, segment], ...]
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recorded_tracks_user_started_idx
  ON public.recorded_tracks (user_id, started_at DESC);

ALTER TABLE public.recorded_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own recorded tracks" ON public.recorded_tracks;
DROP POLICY IF EXISTS "Eligible users can insert own recorded tracks" ON public.recorded_tracks;
DROP POLICY IF EXISTS "Eligible users can update own recorded tracks" ON public.recorded_tracks;
DROP POLICY IF EXISTS "Users can delete own recorded tracks" ON public.recorded_tracks;

CREATE POLICY "Users can view own recorded tracks"
ON public.recorded_tracks
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Eligible users can insert own recorded tracks"
ON public.recorded_tracks
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can_use_track_recorder());

CREATE POLICY "Eligible users can update own recorded tracks"
ON public.recorded_tracks
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND public.can_use_track_recorder());

CREATE POLICY "Users can delete own recorded tracks"
ON public.recorded_tracks
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
