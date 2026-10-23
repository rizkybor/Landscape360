-- Track Recorder: recording limited to Enterprise + admin, and track sharing.
-- Requires 20261024000000_create_recorded_tracks.sql. Safe to re-run.

-- 1. Only Enterprise and admin accounts may record (create/update) tracks.
--    Other accounts keep read/delete access to their existing tracks.
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
      AND (is_admin OR status_subscribe = 'Enterprise')
  );
$$;

-- 2. Shares: one row per (track, recipient). owner_id is stored so share policies never
--    query recorded_tracks (that would make the two tables' policies recurse).
CREATE TABLE IF NOT EXISTS public.recorded_track_shares (
  track_id UUID NOT NULL REFERENCES public.recorded_tracks(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (track_id, shared_with),
  CHECK (owner_id <> shared_with)
);

CREATE INDEX IF NOT EXISTS recorded_track_shares_shared_with_idx
  ON public.recorded_track_shares (shared_with);

CREATE OR REPLACE FUNCTION public.is_recorded_track_owner(p_track_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recorded_tracks
    WHERE id = p_track_id AND user_id = auth.uid()
  );
$$;

ALTER TABLE public.recorded_track_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and recipients can view shares" ON public.recorded_track_shares;
DROP POLICY IF EXISTS "Eligible owners can share own tracks" ON public.recorded_track_shares;
DROP POLICY IF EXISTS "Owners and recipients can remove shares" ON public.recorded_track_shares;

CREATE POLICY "Owners and recipients can view shares"
ON public.recorded_track_shares
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR shared_with = auth.uid());

CREATE POLICY "Eligible owners can share own tracks"
ON public.recorded_track_shares
FOR INSERT
TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND public.is_recorded_track_owner(track_id)
  AND public.can_use_track_recorder()
);

-- Owner revokes access, or the recipient removes the track from their list
CREATE POLICY "Owners and recipients can remove shares"
ON public.recorded_track_shares
FOR DELETE
TO authenticated
USING (owner_id = auth.uid() OR shared_with = auth.uid());

-- 3. Recipients can read tracks shared with them.
DROP POLICY IF EXISTS "Users can view own recorded tracks" ON public.recorded_tracks;
DROP POLICY IF EXISTS "Users can view own or shared recorded tracks" ON public.recorded_tracks;

CREATE POLICY "Users can view own or shared recorded tracks"
ON public.recorded_tracks
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.recorded_track_shares s
    WHERE s.track_id = recorded_tracks.id AND s.shared_with = auth.uid()
  )
);

-- 4. Share a track by the recipient's email. Looks the account up server-side so the
--    client never needs to read other users' profiles.
CREATE OR REPLACE FUNCTION public.share_recorded_track(p_track_id UUID, p_email TEXT)
RETURNS TABLE (shared_with UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient UUID;
  v_email TEXT;
BEGIN
  IF NOT public.is_recorded_track_owner(p_track_id) THEN
    RAISE EXCEPTION 'Track not found or not yours';
  END IF;
  IF NOT public.can_use_track_recorder() THEN
    RAISE EXCEPTION 'Your plan does not allow sharing tracks';
  END IF;

  SELECT p.id, p.email INTO v_recipient, v_email
  FROM public.profiles p
  WHERE lower(p.email) = lower(trim(p_email))
  LIMIT 1;

  IF v_recipient IS NULL THEN
    RAISE EXCEPTION 'No Landscape360 account found for %', trim(p_email);
  END IF;
  IF v_recipient = auth.uid() THEN
    RAISE EXCEPTION 'You cannot share a track with yourself';
  END IF;

  INSERT INTO public.recorded_track_shares (track_id, owner_id, shared_with)
  VALUES (p_track_id, auth.uid(), v_recipient)
  ON CONFLICT (track_id, shared_with) DO NOTHING;

  RETURN QUERY
  SELECT s.shared_with, v_email, s.created_at
  FROM public.recorded_track_shares s
  WHERE s.track_id = p_track_id AND s.shared_with = v_recipient;
END;
$$;

-- 5. Recipients of one of my tracks (with their emails).
CREATE OR REPLACE FUNCTION public.list_recorded_track_shares(p_track_id UUID)
RETURNS TABLE (shared_with UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.shared_with, p.email, s.created_at
  FROM public.recorded_track_shares s
  JOIN public.profiles p ON p.id = s.shared_with
  WHERE s.track_id = p_track_id AND s.owner_id = auth.uid()
  ORDER BY s.created_at;
$$;

-- 6. Tracks shared with me (metadata only, with the owner's email).
CREATE OR REPLACE FUNCTION public.list_tracks_shared_with_me()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  mode TEXT,
  status TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  elapsed_ms BIGINT,
  distance_m DOUBLE PRECISION,
  moving_time_ms BIGINT,
  elevation_gain_m DOUBLE PRECISION,
  elevation_loss_m DOUBLE PRECISION,
  max_alt_m DOUBLE PRECISION,
  min_alt_m DOUBLE PRECISION,
  point_count INTEGER,
  updated_at TIMESTAMPTZ,
  owner_email TEXT,
  shared_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.user_id, t.name, t.mode, t.status, t.started_at, t.ended_at, t.elapsed_ms,
         t.distance_m, t.moving_time_ms, t.elevation_gain_m, t.elevation_loss_m,
         t.max_alt_m, t.min_alt_m, t.point_count, t.updated_at,
         p.email AS owner_email, s.created_at AS shared_at
  FROM public.recorded_track_shares s
  JOIN public.recorded_tracks t ON t.id = s.track_id
  LEFT JOIN public.profiles p ON p.id = t.user_id
  WHERE s.shared_with = auth.uid()
  ORDER BY s.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.share_recorded_track(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_recorded_track_shares(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_tracks_shared_with_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.share_recorded_track(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_recorded_track_shares(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_tracks_shared_with_me() TO authenticated;
