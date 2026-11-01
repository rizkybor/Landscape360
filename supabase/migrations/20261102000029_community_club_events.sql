-- Community Clubs, stage 2 (COMMUNITY_PRD.md §14.4): expeditions and field events.
--   * events: the leader or an admin plans one (time, meeting point, planned route from the
--     workspace, quota, approval); it can be cancelled
--   * participants: members join (with an optional emergency contact only managers see);
--     managers approve or decline when the event asks for approval
--   * checklist: managers list the gear; each participant ticks their own
--   * live tracking, opt-in per event: a participant who is going turns on "Share my position"
--     (from the mobile app) while the event runs; club members see the positions; sharing
--     stops by itself when the event ends. Positions are deleted 30 days after the event ends
--     (purge_community_live, run daily by the cron in api/payments.ts).
-- Requires 20261102000027. Safe to re-run.

-- 1. Tables ------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.community_clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 80),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  meeting_name TEXT CHECK (meeting_name IS NULL OR char_length(meeting_name) <= 120),
  meeting_lat DOUBLE PRECISION CHECK (meeting_lat IS NULL OR meeting_lat BETWEEN -90 AND 90),
  meeting_lng DOUBLE PRECISION CHECK (meeting_lng IS NULL OR meeting_lng BETWEEN -180 AND 180),
  route_item_id UUID REFERENCES public.community_club_items(id) ON DELETE SET NULL,
  quota INTEGER CHECK (quota IS NULL OR quota BETWEEN 1 AND 500),
  needs_approval BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '30 days')
);
CREATE INDEX IF NOT EXISTS community_events_club_idx ON public.community_events (club_id, starts_at DESC);

CREATE TABLE IF NOT EXISTS public.community_event_participants (
  event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'going', 'declined')),
  emergency_name TEXT CHECK (emergency_name IS NULL OR char_length(emergency_name) <= 80),
  emergency_phone TEXT CHECK (emergency_phone IS NULL OR char_length(emergency_phone) <= 30),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_event_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_event_checklist_event_idx ON public.community_event_checklist (event_id, created_at);

CREATE TABLE IF NOT EXISTS public.community_event_checks (
  item_id UUID NOT NULL REFERENCES public.community_event_checklist(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, user_id)
);

-- Who shares their position for an event (stopped_at: stopped by hand)
CREATE TABLE IF NOT EXISTS public.community_live_sharing (
  event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stopped_at TIMESTAMPTZ,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_live_positions (
  id BIGSERIAL PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy_m REAL,
  altitude_m REAL,
  speed_ms REAL,
  battery SMALLINT CHECK (battery IS NULL OR battery BETWEEN 0 AND 100),
  recorded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_live_positions_idx ON public.community_live_positions (event_id, user_id, recorded_at);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['community_events', 'community_event_participants', 'community_event_checklist', 'community_event_checks',
                           'community_live_sharing', 'community_live_positions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin reads everything" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admin reads everything" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- 2. Helpers -----------------------------------------------------------------------------------

-- planned · running · ended · cancelled
CREATE OR REPLACE FUNCTION public.community_event_state(e public.community_events)
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
  SELECT CASE WHEN e.cancelled_at IS NOT NULL THEN 'cancelled'
              WHEN now() < e.starts_at THEN 'planned'
              WHEN now() <= e.ends_at THEN 'running'
              ELSE 'ended' END;
$$;

-- Live sharing is possible from 2 hours before the start (travel to the meeting point) to the end
CREATE OR REPLACE FUNCTION public.community_event_live_window(e public.community_events)
RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
  SELECT e.cancelled_at IS NULL AND now() BETWEEN e.starts_at - interval '2 hours' AND e.ends_at;
$$;

CREATE OR REPLACE FUNCTION public.community_event_club(p_event_id UUID)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT club_id FROM public.community_events WHERE id = p_event_id;
$$;

-- 3. Events ------------------------------------------------------------------------------------

-- Creates (p_id NULL) or changes an event: the leader or an admin
CREATE OR REPLACE FUNCTION public.save_community_event(
  p_club_id UUID, p_id UUID, p_title TEXT, p_description TEXT, p_starts_at TIMESTAMPTZ, p_ends_at TIMESTAMPTZ,
  p_meeting_name TEXT, p_meeting_lat DOUBLE PRECISION, p_meeting_lng DOUBLE PRECISION,
  p_route_item_id UUID, p_quota INTEGER, p_needs_approval BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_title TEXT := left(public.community_clean(p_title), 80);
  v_id UUID := p_id;
BEGIN
  PERFORM public.community_assert_club_manager(p_club_id);
  IF v_title IS NULL OR char_length(v_title) < 2 THEN RAISE EXCEPTION 'Give the event a title'; END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN RAISE EXCEPTION 'The end must be after the start'; END IF;
  IF p_ends_at > p_starts_at + interval '30 days' THEN RAISE EXCEPTION 'An event can last up to 30 days'; END IF;
  IF (p_meeting_lat IS NULL) <> (p_meeting_lng IS NULL) THEN RAISE EXCEPTION 'Set the whole meeting point'; END IF;
  IF p_route_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.community_club_items WHERE id = p_route_item_id AND club_id = p_club_id AND kind IN ('track', 'area')) THEN
    RAISE EXCEPTION 'The route must be a track or area in this club''s workspace';
  END IF;
  IF p_id IS NULL THEN
    IF p_starts_at < now() - interval '1 day' THEN RAISE EXCEPTION 'The start cannot be in the past'; END IF;
    IF (SELECT count(*) FROM public.community_events WHERE club_id = p_club_id AND ends_at > now() AND cancelled_at IS NULL) >= 20 THEN
      RAISE EXCEPTION 'A club can have up to 20 upcoming events';
    END IF;
    INSERT INTO public.community_events (club_id, title, description, starts_at, ends_at, meeting_name, meeting_lat, meeting_lng,
                                         route_item_id, quota, needs_approval, created_by)
    VALUES (p_club_id, v_title, left(public.community_clean(p_description), 2000), p_starts_at, p_ends_at,
            left(public.community_clean(p_meeting_name), 120), p_meeting_lat, p_meeting_lng, p_route_item_id, p_quota,
            COALESCE(p_needs_approval, false), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.community_events
    SET title = v_title, description = left(public.community_clean(p_description), 2000), starts_at = p_starts_at, ends_at = p_ends_at,
        meeting_name = left(public.community_clean(p_meeting_name), 120), meeting_lat = p_meeting_lat, meeting_lng = p_meeting_lng,
        route_item_id = p_route_item_id, quota = p_quota, needs_approval = COALESCE(p_needs_approval, false), updated_at = now()
    WHERE id = p_id AND club_id = p_club_id AND cancelled_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Event not found or cancelled'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- Cancels the event (it stays in the list as cancelled); live sharing stops
CREATE OR REPLACE FUNCTION public.cancel_community_event(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.community_assert_club_manager(public.community_event_club(p_id));
  UPDATE public.community_events SET cancelled_at = COALESCE(cancelled_at, now()), updated_at = now() WHERE id = p_id;
  UPDATE public.community_live_sharing SET stopped_at = now() WHERE event_id = p_id AND stopped_at IS NULL;
END;
$$;

-- Deletes the event with its participants, checklist and positions
CREATE OR REPLACE FUNCTION public.delete_community_event(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_club UUID := public.community_event_club(p_id);
BEGIN
  IF v_club IS NULL THEN RETURN; END IF;
  PERFORM public.community_assert_club_manager(v_club);
  DELETE FROM public.community_events WHERE id = p_id;
END;
$$;

-- The club's events: p_past false = running and upcoming (soonest first), true = ended and cancelled
CREATE OR REPLACE FUNCTION public.community_events(p_club_id UUID, p_past BOOLEAN DEFAULT false)
RETURNS TABLE (
  id UUID, title TEXT, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, state TEXT, meeting_name TEXT,
  going_count INTEGER, pending_count INTEGER, quota INTEGER, my_status TEXT, sharing_count INTEGER
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.title, e.starts_at, e.ends_at, public.community_event_state(e), e.meeting_name,
         (SELECT count(*) FROM public.community_event_participants p WHERE p.event_id = e.id AND p.status = 'going')::INTEGER,
         (SELECT count(*) FROM public.community_event_participants p WHERE p.event_id = e.id AND p.status = 'pending')::INTEGER,
         e.quota,
         (SELECT p.status FROM public.community_event_participants p WHERE p.event_id = e.id AND p.user_id = auth.uid()),
         (SELECT count(*) FROM public.community_live_sharing s
          WHERE s.event_id = e.id AND s.stopped_at IS NULL AND public.community_event_live_window(e))::INTEGER
  FROM public.community_events e
  WHERE e.club_id = p_club_id AND (public.community_is_member(p_club_id) OR public.is_admin())
    AND (CASE WHEN p_past THEN e.ends_at < now() OR e.cancelled_at IS NOT NULL
              ELSE e.ends_at >= now() AND e.cancelled_at IS NULL END)
  ORDER BY CASE WHEN p_past THEN NULL ELSE e.starts_at END ASC, e.starts_at DESC
  LIMIT 100;
$$;

-- One event in full, with the caller's participation and emergency contact
CREATE OR REPLACE FUNCTION public.community_event(p_id UUID)
RETURNS TABLE (
  id UUID, club_id UUID, club_name TEXT, title TEXT, description TEXT, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, state TEXT,
  meeting_name TEXT, meeting_lat DOUBLE PRECISION, meeting_lng DOUBLE PRECISION, route_item_id UUID, route_name TEXT,
  quota INTEGER, needs_approval BOOLEAN, going_count INTEGER, pending_count INTEGER, created_by_name TEXT,
  my_status TEXT, my_emergency_name TEXT, my_emergency_phone TEXT, i_am_sharing BOOLEAN, can_share BOOLEAN, can_manage BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.id, e.club_id, c.name, e.title, e.description, e.starts_at, e.ends_at, public.community_event_state(e),
         e.meeting_name, e.meeting_lat, e.meeting_lng, e.route_item_id, ri.name,
         e.quota, e.needs_approval,
         (SELECT count(*) FROM public.community_event_participants p WHERE p.event_id = e.id AND p.status = 'going')::INTEGER,
         (SELECT count(*) FROM public.community_event_participants p WHERE p.event_id = e.id AND p.status = 'pending')::INTEGER,
         public.review_author_name(e.created_by),
         me.status, me.emergency_name, me.emergency_phone,
         EXISTS (SELECT 1 FROM public.community_live_sharing s WHERE s.event_id = e.id AND s.user_id = auth.uid() AND s.stopped_at IS NULL)
           AND public.community_event_live_window(e),
         COALESCE(me.status = 'going', false) AND public.community_event_live_window(e),
         public.community_club_role(e.club_id) IN ('owner', 'admin')
           AND (SELECT l.clubs FROM public.community_club_limits(c.owner_id) l) IS DISTINCT FROM 0
  FROM public.community_events e
  JOIN public.community_clubs c ON c.id = e.club_id
  LEFT JOIN public.community_club_items ri ON ri.id = e.route_item_id
  LEFT JOIN public.community_event_participants me ON me.event_id = e.id AND me.user_id = auth.uid()
  WHERE e.id = p_id AND (public.community_is_member(e.club_id) OR public.is_admin());
$$;

-- 4. Participants ------------------------------------------------------------------------------

-- A member joins (going, or pending when the event asks for approval) and may leave an
-- emergency contact for the organisers; joining again updates the contact
CREATE OR REPLACE FUNCTION public.join_community_event(p_id UUID, p_emergency_name TEXT, p_emergency_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  e public.community_events%ROWTYPE;
  v_status TEXT;
  v_old TEXT;
BEGIN
  PERFORM public.community_assert_can_write();
  SELECT * INTO e FROM public.community_events WHERE id = p_id;
  IF NOT FOUND OR NOT public.community_is_member(e.club_id) THEN RAISE EXCEPTION 'Only club members can join'; END IF;
  IF e.cancelled_at IS NOT NULL OR e.ends_at < now() THEN RAISE EXCEPTION 'This event has ended or was cancelled'; END IF;
  SELECT status INTO v_old FROM public.community_event_participants WHERE event_id = p_id AND user_id = auth.uid();
  IF v_old = 'declined' THEN RAISE EXCEPTION 'The organisers declined your request for this event'; END IF;
  v_status := COALESCE(v_old, CASE WHEN e.needs_approval THEN 'pending' ELSE 'going' END);
  IF v_old IS NULL AND v_status = 'going' AND e.quota IS NOT NULL
     AND (SELECT count(*) FROM public.community_event_participants WHERE event_id = p_id AND status = 'going') >= e.quota THEN
    RAISE EXCEPTION 'This event is full (% people)', e.quota;
  END IF;
  INSERT INTO public.community_event_participants (event_id, user_id, status, emergency_name, emergency_phone)
  VALUES (p_id, auth.uid(), v_status, left(public.community_clean(p_emergency_name), 80), left(public.community_clean(p_emergency_phone), 30))
  ON CONFLICT (event_id, user_id) DO UPDATE
  SET emergency_name = EXCLUDED.emergency_name, emergency_phone = EXCLUDED.emergency_phone;
  RETURN v_status;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_community_event(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  DELETE FROM public.community_event_participants WHERE event_id = p_id AND user_id = auth.uid() AND status <> 'declined';
  UPDATE public.community_live_sharing SET stopped_at = now() WHERE event_id = p_id AND user_id = auth.uid() AND stopped_at IS NULL;
END;
$$;

-- Managers approve (going) or decline a participant
CREATE OR REPLACE FUNCTION public.decide_community_event_participant(p_id UUID, p_user_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  e public.community_events%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.community_events WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  PERFORM public.community_assert_club_manager(e.club_id);
  IF p_status NOT IN ('going', 'declined') THEN RAISE EXCEPTION 'Unknown decision'; END IF;
  IF p_status = 'going' AND e.quota IS NOT NULL
     AND (SELECT count(*) FROM public.community_event_participants WHERE event_id = p_id AND status = 'going' AND user_id <> p_user_id) >= e.quota THEN
    RAISE EXCEPTION 'This event is full (% people)', e.quota;
  END IF;
  UPDATE public.community_event_participants SET status = p_status, decided_by = auth.uid() WHERE event_id = p_id AND user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not a participant'; END IF;
  IF p_status = 'declined' THEN
    UPDATE public.community_live_sharing SET stopped_at = now() WHERE event_id = p_id AND user_id = p_user_id AND stopped_at IS NULL;
  END IF;
END;
$$;

-- Participants with live status; emergency contacts only for managers
CREATE OR REPLACE FUNCTION public.community_event_participants(p_id UUID)
RETURNS TABLE (
  user_id UUID, name TEXT, organization TEXT, status TEXT, joined_at TIMESTAMPTZ, is_me BOOLEAN,
  emergency_name TEXT, emergency_phone TEXT, checked_count INTEGER, sharing BOOLEAN, last_seen_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, public.review_author_name(p.user_id), NULLIF(trim(pr.organization), ''), p.status, p.joined_at, p.user_id = auth.uid(),
         CASE WHEN mgr.ok THEN p.emergency_name END, CASE WHEN mgr.ok THEN p.emergency_phone END,
         (SELECT count(*) FROM public.community_event_checks k JOIN public.community_event_checklist i ON i.id = k.item_id
          WHERE i.event_id = p.event_id AND k.user_id = p.user_id)::INTEGER,
         EXISTS (SELECT 1 FROM public.community_live_sharing s WHERE s.event_id = p.event_id AND s.user_id = p.user_id AND s.stopped_at IS NULL)
           AND public.community_event_live_window(e),
         (SELECT max(l.recorded_at) FROM public.community_live_positions l WHERE l.event_id = p.event_id AND l.user_id = p.user_id)
  FROM public.community_event_participants p
  JOIN public.community_events e ON e.id = p.event_id
  LEFT JOIN public.profiles pr ON pr.id = p.user_id
  CROSS JOIN LATERAL (SELECT public.community_club_role(e.club_id) IN ('owner', 'admin') AS ok) mgr
  WHERE p.event_id = p_id AND (public.community_is_member(e.club_id) OR public.is_admin())
    AND (p.status = 'going' OR mgr.ok OR p.user_id = auth.uid())
  ORDER BY CASE p.status WHEN 'pending' THEN 0 WHEN 'going' THEN 1 ELSE 2 END, p.joined_at;
$$;

-- 5. Checklist ---------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_community_event_checklist_item(p_id UUID, p_label TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_label TEXT := left(public.community_clean(p_label), 80);
  v_item UUID;
BEGIN
  PERFORM public.community_assert_club_manager(public.community_event_club(p_id));
  IF v_label IS NULL THEN RAISE EXCEPTION 'Write the item first'; END IF;
  IF (SELECT count(*) FROM public.community_event_checklist WHERE event_id = p_id) >= 60 THEN
    RAISE EXCEPTION 'A checklist can have up to 60 items';
  END IF;
  INSERT INTO public.community_event_checklist (event_id, label) VALUES (p_id, v_label) RETURNING id INTO v_item;
  RETURN v_item;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_community_event_checklist_item(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event UUID;
BEGIN
  SELECT event_id INTO v_event FROM public.community_event_checklist WHERE id = p_item_id;
  IF v_event IS NULL THEN RETURN; END IF;
  PERFORM public.community_assert_club_manager(public.community_event_club(v_event));
  DELETE FROM public.community_event_checklist WHERE id = p_item_id;
END;
$$;

-- A participant (pending or going) ticks or unticks their own item; returns whether it is ticked
CREATE OR REPLACE FUNCTION public.toggle_community_event_check(p_item_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event UUID;
BEGIN
  SELECT event_id INTO v_event FROM public.community_event_checklist WHERE id = p_item_id;
  IF v_event IS NULL THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_event_participants WHERE event_id = v_event AND user_id = auth.uid() AND status IN ('pending', 'going')) THEN
    RAISE EXCEPTION 'Join the event to use its checklist';
  END IF;
  IF EXISTS (SELECT 1 FROM public.community_event_checks WHERE item_id = p_item_id AND user_id = auth.uid()) THEN
    DELETE FROM public.community_event_checks WHERE item_id = p_item_id AND user_id = auth.uid();
    RETURN false;
  END IF;
  INSERT INTO public.community_event_checks (item_id, user_id) VALUES (p_item_id, auth.uid());
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_event_checklist(p_id UUID)
RETURNS TABLE (id UUID, label TEXT, checked BOOLEAN, checked_count INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.label,
         EXISTS (SELECT 1 FROM public.community_event_checks k WHERE k.item_id = i.id AND k.user_id = auth.uid()),
         (SELECT count(*) FROM public.community_event_checks k WHERE k.item_id = i.id)::INTEGER
  FROM public.community_event_checklist i
  WHERE i.event_id = p_id AND (public.community_is_member(public.community_event_club(p_id)) OR public.is_admin())
  ORDER BY i.created_at;
$$;

-- 6. Live tracking -----------------------------------------------------------------------------

-- A participant who is going turns sharing on (from 2 hours before the start to the end)
CREATE OR REPLACE FUNCTION public.start_community_live(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  e public.community_events%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO e FROM public.community_events WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_event_participants WHERE event_id = p_id AND user_id = auth.uid() AND status = 'going') THEN
    RAISE EXCEPTION 'Only participants who are going can share their position';
  END IF;
  IF NOT public.community_event_live_window(e) THEN
    RAISE EXCEPTION 'Position sharing is open from 2 hours before the start until the end of the event';
  END IF;
  INSERT INTO public.community_live_sharing (event_id, user_id) VALUES (p_id, auth.uid())
  ON CONFLICT (event_id, user_id) DO UPDATE SET started_at = now(), stopped_at = NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.stop_community_live(p_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.community_live_sharing SET stopped_at = now() WHERE event_id = p_id AND user_id = auth.uid() AND stopped_at IS NULL;
$$;

-- Positions from the app, in batches (sent again after being offline):
-- [{ "lat", "lng", "accuracy_m", "altitude_m", "speed_ms", "battery", "recorded_at" }, …], up to 500.
-- Returns whether to keep sharing (false once stopped, declined, cancelled or ended).
CREATE OR REPLACE FUNCTION public.report_community_live(p_id UUID, p_points JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  e public.community_events%ROWTYPE;
  s public.community_live_sharing%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT * INTO e FROM public.community_events WHERE id = p_id;
  SELECT * INTO s FROM public.community_live_sharing WHERE event_id = p_id AND user_id = auth.uid();
  IF e.id IS NULL OR s.event_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.community_event_participants WHERE event_id = p_id AND user_id = auth.uid() AND status = 'going') THEN
    RETURN false;
  END IF;
  IF jsonb_typeof(p_points) <> 'array' OR jsonb_array_length(p_points) > 500 THEN RAISE EXCEPTION 'Send up to 500 positions at a time'; END IF;
  -- Points taken while sharing was on and inside the event's window (a late batch after the end still counts)
  INSERT INTO public.community_live_positions (event_id, user_id, lat, lng, accuracy_m, altitude_m, speed_ms, battery, recorded_at)
  SELECT p_id, auth.uid(), (pt->>'lat')::double precision, (pt->>'lng')::double precision,
         (pt->>'accuracy_m')::real, (pt->>'altitude_m')::real, (pt->>'speed_ms')::real,
         least(greatest((pt->>'battery')::int, 0), 100)::smallint, (pt->>'recorded_at')::timestamptz
  FROM jsonb_array_elements(p_points) pt
  WHERE (pt->>'lat')::double precision BETWEEN -90 AND 90 AND (pt->>'lng')::double precision BETWEEN -180 AND 180
    AND (pt->>'recorded_at')::timestamptz BETWEEN greatest(s.started_at, e.starts_at - interval '2 hours') - interval '1 minute'
                                              AND least(COALESCE(s.stopped_at, e.ends_at), e.ends_at, now() + interval '5 minutes');
  RETURN s.stopped_at IS NULL AND public.community_event_live_window(e);
END;
$$;

-- The last position of each participant who shared, for the live map
CREATE OR REPLACE FUNCTION public.community_live_latest(p_id UUID)
RETURNS TABLE (
  user_id UUID, name TEXT, lat DOUBLE PRECISION, lng DOUBLE PRECISION, accuracy_m REAL, altitude_m REAL, battery SMALLINT,
  recorded_at TIMESTAMPTZ, sharing BOOLEAN, is_me BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT ON (l.user_id) l.user_id, public.review_author_name(l.user_id), l.lat, l.lng, l.accuracy_m, l.altitude_m, l.battery,
         l.recorded_at,
         EXISTS (SELECT 1 FROM public.community_live_sharing s WHERE s.event_id = l.event_id AND s.user_id = l.user_id AND s.stopped_at IS NULL)
           AND public.community_event_live_window(e),
         l.user_id = auth.uid()
  FROM public.community_live_positions l
  JOIN public.community_events e ON e.id = l.event_id
  WHERE l.event_id = p_id AND (public.community_is_member(e.club_id) OR public.is_admin())
  ORDER BY l.user_id, l.recorded_at DESC;
$$;

-- One participant's trail (oldest first), thinned to at most 5000 points
CREATE OR REPLACE FUNCTION public.community_live_trail(p_id UUID, p_user_id UUID)
RETURNS TABLE (lat DOUBLE PRECISION, lng DOUBLE PRECISION, altitude_m REAL, recorded_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH pts AS (
    SELECT l.lat, l.lng, l.altitude_m, l.recorded_at, row_number() OVER (ORDER BY l.recorded_at) AS n, count(*) OVER () AS total
    FROM public.community_live_positions l
    WHERE l.event_id = p_id AND l.user_id = p_user_id
      AND (public.community_is_member(public.community_event_club(p_id)) OR public.is_admin())
  )
  SELECT lat, lng, altitude_m, recorded_at FROM pts
  WHERE total <= 5000 OR n = total OR (n - 1) % ceil(total / 5000.0)::int = 0
  ORDER BY recorded_at;
$$;

-- Daily cleanup: positions of events that ended (or were cancelled) more than 30 days ago
CREATE OR REPLACE FUNCTION public.purge_community_live()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.community_live_positions l USING public.community_events e
  WHERE e.id = l.event_id AND COALESCE(least(e.cancelled_at, e.ends_at), e.ends_at) < now() - interval '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  DELETE FROM public.community_live_sharing s USING public.community_events e
  WHERE e.id = s.event_id AND COALESCE(least(e.cancelled_at, e.ends_at), e.ends_at) < now() - interval '30 days';
  RETURN v_count;
END;
$$;

-- 7. Who may call what --------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.community_event_club(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purge_community_live() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_community_live() TO service_role;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'save_community_event(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, UUID, INTEGER, BOOLEAN)',
    'cancel_community_event(UUID)', 'delete_community_event(UUID)', 'community_events(UUID, BOOLEAN)', 'community_event(UUID)',
    'join_community_event(UUID, TEXT, TEXT)', 'leave_community_event(UUID)', 'decide_community_event_participant(UUID, UUID, TEXT)',
    'community_event_participants(UUID)', 'add_community_event_checklist_item(UUID, TEXT)',
    'delete_community_event_checklist_item(UUID)', 'toggle_community_event_check(UUID)', 'community_event_checklist(UUID)',
    'start_community_live(UUID)', 'stop_community_live(UUID)', 'report_community_live(UUID, JSONB)',
    'community_live_latest(UUID)', 'community_live_trail(UUID, UUID)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
