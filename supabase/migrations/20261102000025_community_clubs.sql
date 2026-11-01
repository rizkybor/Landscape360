-- Community Clubs (COMMUNITY_PRD.md §14): Enterprise accounts (and the admin) create clubs and add
-- members by email; any signed-in account can be a member. A post goes to everyone or to one club;
-- club posts are seen only by its members (and the admin), never on the public page.
-- Requires 20261102000024_community.sql. Safe to re-run until a later Community migration is applied.

-- Guard: a later Community migration replaces functions in this file; running this one again
-- after it would bring back older versions (for example a feed without the club rules).
DO $$
BEGIN
  IF to_regclass('public.community_club_invites') IS NOT NULL THEN
    RAISE EXCEPTION 'Community is already upgraded by 20261102000027 (club workspace). Do not run this older migration again; run the latest one instead.';
  END IF;
END $$;

-- 1. Tables ----------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_clubs_owner_idx ON public.community_clubs (owner_id);

CREATE TABLE IF NOT EXISTS public.community_club_members (
  club_id UUID NOT NULL REFERENCES public.community_clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);
CREATE INDEX IF NOT EXISTS community_club_members_user_idx ON public.community_club_members (user_id);

ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.community_clubs(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS community_posts_club_idx ON public.community_posts (club_id, created_at DESC) WHERE club_id IS NOT NULL;

ALTER TABLE public.community_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_club_members ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['community_clubs', 'community_club_members'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admin reads everything" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admin reads everything" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- 2. Helpers ----------------------------------------------------------------------------------

-- Clubs an account may own (NULL: no limit; 0: may not create) and members per club.
-- Keep in sync with src/lib/community.ts and the app.
CREATE OR REPLACE FUNCTION public.community_club_limits(p_user_id UUID)
RETURNS TABLE (clubs INTEGER, members INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE WHEN p.is_admin THEN NULL WHEN p.status_subscribe = 'Enterprise' THEN 5 ELSE 0 END,
    CASE WHEN p.is_admin THEN 1000 ELSE 200 END
  FROM (SELECT 1) one
  LEFT JOIN public.profiles p ON p.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.community_is_member(p_club_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_club_members WHERE club_id = p_club_id AND user_id = auth.uid());
$$;

-- May the caller see this post? Public posts: anyone; club posts: members and the admin
CREATE OR REPLACE FUNCTION public.community_can_see(p_club_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_club_id IS NULL OR public.community_is_member(p_club_id) OR COALESCE(public.is_admin(), false);
$$;

-- The owner manages members only while the account may still own clubs (Enterprise or admin)
CREATE OR REPLACE FUNCTION public.community_assert_club_owner(p_club_id UUID)
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_clubs WHERE id = p_club_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the club owner can do this';
  END IF;
  IF (SELECT clubs FROM public.community_club_limits(auth.uid())) = 0 THEN
    RAISE EXCEPTION 'Managing a club needs an Enterprise account';
  END IF;
END;
$$;

-- 3. Clubs ------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_community_club(p_name TEXT, p_description TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_max INTEGER;
  v_name TEXT := left(public.community_clean(p_name), 60);
  v_id UUID;
BEGIN
  PERFORM public.community_assert_can_write();
  SELECT clubs INTO v_max FROM public.community_club_limits(auth.uid());
  IF v_max = 0 THEN RAISE EXCEPTION 'Creating a club needs an Enterprise account'; END IF;
  IF v_name IS NULL OR char_length(v_name) < 2 THEN RAISE EXCEPTION 'Give the club a name'; END IF;
  IF v_max IS NOT NULL AND (SELECT count(*) FROM public.community_clubs WHERE owner_id = auth.uid()) >= v_max THEN
    RAISE EXCEPTION 'You can have up to % clubs', v_max;
  END IF;
  INSERT INTO public.community_clubs (owner_id, name, description)
  VALUES (auth.uid(), v_name, left(public.community_clean(p_description), 500))
  RETURNING id INTO v_id;
  INSERT INTO public.community_club_members (club_id, user_id, role, added_by) VALUES (v_id, auth.uid(), 'owner', auth.uid());
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_community_club(p_id UUID, p_name TEXT, p_description TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name TEXT := left(public.community_clean(p_name), 60);
BEGIN
  PERFORM public.community_assert_club_owner(p_id);
  IF v_name IS NULL OR char_length(v_name) < 2 THEN RAISE EXCEPTION 'Give the club a name'; END IF;
  UPDATE public.community_clubs SET name = v_name, description = left(public.community_clean(p_description), 500) WHERE id = p_id;
END;
$$;

-- Deletes the club with its posts; returns the photo files to remove. The owner (any plan) or the admin.
CREATE OR REPLACE FUNCTION public.delete_community_club(p_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_paths TEXT[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.community_clubs WHERE id = p_id AND (owner_id = auth.uid() OR public.is_admin())) THEN
    RAISE EXCEPTION 'Only the club owner can delete the club';
  END IF;
  SELECT COALESCE(array_agg(ph.path), '{}') INTO v_paths
  FROM public.community_photos ph JOIN public.community_posts p ON p.id = ph.post_id WHERE p.club_id = p_id;
  DELETE FROM public.community_reports WHERE target_kind = 'post' AND target_id IN (SELECT id FROM public.community_posts WHERE club_id = p_id);
  DELETE FROM public.community_reports WHERE target_kind = 'comment' AND target_id IN (
    SELECT c.id FROM public.community_comments c JOIN public.community_posts p ON p.id = c.post_id WHERE p.club_id = p_id);
  DELETE FROM public.community_clubs WHERE id = p_id;
  RETURN v_paths;
END;
$$;

-- Adds the account that uses this email. The email never leaves the server except back to the
-- owner who typed it.
CREATE OR REPLACE FUNCTION public.add_community_club_member(p_club_id UUID, p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_max INTEGER;
BEGIN
  PERFORM public.community_assert_club_owner(p_club_id);
  SELECT id INTO v_user FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'No Landscape 360 account uses that email'; END IF;
  IF EXISTS (SELECT 1 FROM public.community_club_members WHERE club_id = p_club_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'This account is already a member';
  END IF;
  SELECT members INTO v_max FROM public.community_club_limits(auth.uid());
  IF (SELECT count(*) FROM public.community_club_members WHERE club_id = p_club_id) >= v_max THEN
    RAISE EXCEPTION 'A club can have up to % members', v_max;
  END IF;
  INSERT INTO public.community_club_members (club_id, user_id, role, added_by) VALUES (p_club_id, v_user, 'member', auth.uid());
  RETURN public.review_author_name(v_user);
END;
$$;

-- The owner removes a member; a member removes themself (leaves). The owner cannot leave.
CREATE OR REPLACE FUNCTION public.remove_community_club_member(p_club_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF EXISTS (SELECT 1 FROM public.community_clubs WHERE id = p_club_id AND owner_id = p_user_id) THEN
    RAISE EXCEPTION 'The owner cannot leave the club. Delete the club instead.';
  END IF;
  IF p_user_id <> auth.uid() AND NOT EXISTS (SELECT 1 FROM public.community_clubs WHERE id = p_club_id AND owner_id = auth.uid()) THEN
    RAISE EXCEPTION 'Only the club owner can remove members';
  END IF;
  DELETE FROM public.community_club_members WHERE club_id = p_club_id AND user_id = p_user_id;
END;
$$;

-- The caller's clubs, owned first
CREATE OR REPLACE FUNCTION public.my_community_clubs()
RETURNS TABLE (id UUID, name TEXT, description TEXT, role TEXT, member_count INTEGER, owner_name TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name, c.description, m.role,
         (SELECT count(*) FROM public.community_club_members x WHERE x.club_id = c.id)::INTEGER,
         public.review_author_name(c.owner_id), c.created_at
  FROM public.community_club_members m
  JOIN public.community_clubs c ON c.id = m.club_id
  WHERE m.user_id = auth.uid()
  ORDER BY (m.role = 'owner') DESC, c.name;
$$;

-- Members of a club, for its members. Only the owner sees emails.
CREATE OR REPLACE FUNCTION public.community_club_members(p_club_id UUID)
RETURNS TABLE (user_id UUID, name TEXT, organization TEXT, email TEXT, role TEXT, added_at TIMESTAMPTZ, is_me BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.user_id, public.review_author_name(m.user_id), NULLIF(trim(pr.organization), ''),
         CASE WHEN EXISTS (SELECT 1 FROM public.community_clubs c WHERE c.id = p_club_id AND c.owner_id = auth.uid()) THEN pr.email END,
         m.role, m.created_at, m.user_id = auth.uid()
  FROM public.community_club_members m
  LEFT JOIN public.profiles pr ON pr.id = m.user_id
  WHERE m.club_id = p_club_id AND (public.community_is_member(p_club_id) OR public.is_admin())
  ORDER BY (m.role = 'owner') DESC, m.created_at;
$$;

-- 4. Posts: one club or everyone --------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_community_post(TEXT, TEXT, TEXT, TEXT[], DATE, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.create_community_post(
  p_kind TEXT, p_title TEXT, p_body TEXT, p_conditions TEXT[], p_happened_on DATE,
  p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_place_name TEXT, p_attachment JSONB, p_club_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  lim RECORD;
  v_body TEXT := public.community_clean(p_body);
  v_title TEXT := public.community_clean(p_title);
  v_id UUID;
  v_today INTEGER;
BEGIN
  PERFORM public.community_assert_can_write();
  SELECT * INTO lim FROM public.community_limits(auth.uid());

  IF p_kind NOT IN ('report', 'story') THEN RAISE EXCEPTION 'Unknown post type'; END IF;
  IF v_body IS NULL THEN RAISE EXCEPTION 'Write something first'; END IF;
  IF p_kind = 'report' AND char_length(v_body) > 500 THEN RAISE EXCEPTION 'A trail report is at most 500 characters'; END IF;
  IF p_kind = 'report' AND COALESCE(cardinality(p_conditions), 0) = 0 THEN RAISE EXCEPTION 'Choose at least one trail condition'; END IF;
  IF NOT public.community_conditions_ok(p_conditions) THEN RAISE EXCEPTION 'Unknown trail condition'; END IF;
  IF p_happened_on IS NULL OR p_happened_on > current_date + 1 OR p_happened_on < current_date - 366 THEN
    RAISE EXCEPTION 'The date must be within the last year and not in the future';
  END IF;
  IF p_attachment IS NOT NULL THEN
    IF NOT lim.attachments THEN RAISE EXCEPTION 'Attaching map data is for Pro and Enterprise accounts'; END IF;
    IF p_attachment->>'kind' NOT IN ('track', 'area', 'place', 'classic') THEN RAISE EXCEPTION 'Unknown attachment'; END IF;
  END IF;
  IF p_club_id IS NOT NULL AND NOT public.community_is_member(p_club_id) THEN
    RAISE EXCEPTION 'You can only post in clubs you are a member of';
  END IF;

  -- Daily limit per type (last 24 hours)
  SELECT count(*) INTO v_today FROM public.community_posts
  WHERE author_id = auth.uid() AND kind = p_kind AND created_at > now() - interval '1 day';
  IF (p_kind = 'report' AND lim.reports IS NOT NULL AND v_today >= lim.reports)
     OR (p_kind = 'story' AND lim.stories IS NOT NULL AND v_today >= lim.stories) THEN
    RAISE EXCEPTION 'You have reached today''s limit of % for your plan. Try again tomorrow.',
      CASE WHEN p_kind = 'report' THEN lim.reports || ' trail reports' ELSE lim.stories || ' stories' END;
  END IF;

  INSERT INTO public.community_posts (author_id, kind, title, body, conditions, happened_on, lat, lng, place_name, attachment, club_id)
  VALUES (auth.uid(), p_kind, left(v_title, 80), v_body, COALESCE(p_conditions, '{}'), p_happened_on, p_lat, p_lng,
          left(public.community_clean(p_place_name), 120), p_attachment, p_club_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Helpful, comments and reports only on posts the caller can see
CREATE OR REPLACE FUNCTION public.toggle_community_helpful(p_post_id UUID)
RETURNS TABLE (helpful BOOLEAN, helpful_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = p_post_id AND p.status = 'visible' AND public.community_can_see(p.club_id)) THEN
    RAISE EXCEPTION 'This post is not available';
  END IF;
  IF EXISTS (SELECT 1 FROM public.community_reactions WHERE post_id = p_post_id AND user_id = auth.uid()) THEN
    DELETE FROM public.community_reactions WHERE post_id = p_post_id AND user_id = auth.uid();
    UPDATE public.community_posts p SET helpful_count = greatest(p.helpful_count - 1, 0) WHERE p.id = p_post_id;
    helpful := false;
  ELSE
    INSERT INTO public.community_reactions (post_id, user_id) VALUES (p_post_id, auth.uid());
    UPDATE public.community_posts p SET helpful_count = p.helpful_count + 1 WHERE p.id = p_post_id;
    helpful := true;
  END IF;
  SELECT p.helpful_count INTO helpful_count FROM public.community_posts p WHERE p.id = p_post_id;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_community_comment(p_post_id UUID, p_body TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  lim RECORD;
  v_body TEXT := public.community_clean(p_body);
  v_id UUID;
BEGIN
  PERFORM public.community_assert_can_write();
  IF v_body IS NULL THEN RAISE EXCEPTION 'Write a comment first'; END IF;
  IF char_length(v_body) > 1000 THEN RAISE EXCEPTION 'A comment is at most 1000 characters'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = p_post_id AND p.status = 'visible' AND public.community_can_see(p.club_id)) THEN
    RAISE EXCEPTION 'This post is not available';
  END IF;
  SELECT * INTO lim FROM public.community_limits(auth.uid());
  IF lim.comments IS NOT NULL AND (SELECT count(*) FROM public.community_comments WHERE author_id = auth.uid() AND created_at > now() - interval '1 day') >= lim.comments THEN
    RAISE EXCEPTION 'You have reached today''s comment limit. Try again tomorrow.';
  END IF;
  INSERT INTO public.community_comments (post_id, author_id, body) VALUES (p_post_id, auth.uid(), v_body) RETURNING id INTO v_id;
  UPDATE public.community_posts SET comment_count = comment_count + 1 WHERE id = p_post_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_community(p_kind TEXT, p_id UUID, p_reason TEXT, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_old TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to report'; END IF;
  IF p_kind = 'post' AND NOT EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = p_id AND public.community_can_see(p.club_id)) THEN
    RAISE EXCEPTION 'Not found';
  END IF;
  IF p_kind = 'comment' AND NOT EXISTS (
    SELECT 1 FROM public.community_comments c JOIN public.community_posts p ON p.id = c.post_id
    WHERE c.id = p_id AND public.community_can_see(p.club_id)) THEN
    RAISE EXCEPTION 'Not found';
  END IF;
  INSERT INTO public.community_reports (target_kind, target_id, reporter_id, reason, note)
  VALUES (p_kind, p_id, auth.uid(), p_reason, left(public.community_clean(p_note), 500))
  ON CONFLICT (target_kind, target_id, reporter_id) DO NOTHING;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO v_count FROM public.community_reports
  WHERE target_kind = p_kind AND target_id = p_id AND resolved_at IS NULL;
  IF p_kind = 'post' THEN
    UPDATE public.community_posts
    SET report_count = v_count, status = CASE WHEN v_count >= 3 AND status = 'visible' THEN 'hidden' ELSE status END
    WHERE id = p_id;
  ELSE
    SELECT status INTO v_old FROM public.community_comments WHERE id = p_id;
    UPDATE public.community_comments
    SET report_count = v_count, status = CASE WHEN v_count >= 3 AND status = 'visible' THEN 'hidden' ELSE status END
    WHERE id = p_id;
    IF v_old = 'visible' AND v_count >= 3 THEN
      UPDATE public.community_posts SET comment_count = greatest(comment_count - 1, 0)
      WHERE id = (SELECT post_id FROM public.community_comments WHERE id = p_id);
    END IF;
  END IF;
END;
$$;

-- 5. Reading ----------------------------------------------------------------------------------

-- p_club NULL: public posts and the caller's clubs; a club id: only that club (members only)
DROP FUNCTION IF EXISTS public.community_feed(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, INTEGER);
CREATE OR REPLACE FUNCTION public.community_feed(
  p_west DOUBLE PRECISION DEFAULT NULL, p_south DOUBLE PRECISION DEFAULT NULL,
  p_east DOUBLE PRECISION DEFAULT NULL, p_north DOUBLE PRECISION DEFAULT NULL,
  p_kinds TEXT[] DEFAULT NULL, p_conditions TEXT[] DEFAULT NULL,
  p_since TIMESTAMPTZ DEFAULT NULL, p_before TIMESTAMPTZ DEFAULT NULL, p_limit INTEGER DEFAULT 20,
  p_club UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID, kind TEXT, title TEXT, body TEXT, truncated BOOLEAN, conditions TEXT[], happened_on DATE,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION, place_name TEXT, attachment_kind TEXT, photos JSONB,
  helpful_count INTEGER, comment_count INTEGER, created_at TIMESTAMPTZ, edited_at TIMESTAMPTZ,
  author_name TEXT, author_organization TEXT, is_mine BOOLEAN, i_found_helpful BOOLEAN,
  club_id UUID, club_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.kind, p.title, left(p.body, 280), char_length(p.body) > 280, p.conditions, p.happened_on,
         p.lat, p.lng, p.place_name, p.attachment->>'kind', public.community_post_photos(p.id),
         p.helpful_count, p.comment_count, p.created_at, p.edited_at,
         public.review_author_name(p.author_id), NULLIF(trim(pr.organization), ''),
         COALESCE(p.author_id = auth.uid(), false),
         EXISTS (SELECT 1 FROM public.community_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid()),
         p.club_id, cl.name
  FROM public.community_posts p
  LEFT JOIN public.profiles pr ON pr.id = p.author_id
  LEFT JOIN public.community_clubs cl ON cl.id = p.club_id
  WHERE p.status = 'visible'
    AND (CASE WHEN p_club IS NULL
              THEN p.club_id IS NULL OR public.community_is_member(p.club_id)
              ELSE p.club_id = p_club AND public.community_can_see(p_club) END)
    AND (p_west IS NULL OR (p.lng BETWEEN p_west AND p_east AND p.lat BETWEEN p_south AND p_north))
    AND (p_kinds IS NULL OR p.kind = ANY (p_kinds))
    AND (p_conditions IS NULL OR p.conditions && p_conditions)
    AND (p_since IS NULL OR p.created_at >= p_since)
    AND (p_before IS NULL OR p.created_at < p_before)
  ORDER BY p.created_at DESC
  LIMIT least(greatest(COALESCE(p_limit, 20), 1), 300);
$$;

DROP FUNCTION IF EXISTS public.community_post(UUID);
CREATE OR REPLACE FUNCTION public.community_post(p_id UUID)
RETURNS TABLE (
  id UUID, kind TEXT, title TEXT, body TEXT, conditions TEXT[], happened_on DATE,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION, place_name TEXT, attachment JSONB, photos JSONB,
  helpful_count INTEGER, comment_count INTEGER, created_at TIMESTAMPTZ, edited_at TIMESTAMPTZ, status TEXT,
  author_name TEXT, author_organization TEXT, is_mine BOOLEAN, i_found_helpful BOOLEAN,
  club_id UUID, club_name TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.kind, p.title, p.body, p.conditions, p.happened_on, p.lat, p.lng, p.place_name, p.attachment,
         public.community_post_photos(p.id), p.helpful_count, p.comment_count, p.created_at, p.edited_at, p.status,
         public.review_author_name(p.author_id), NULLIF(trim(pr.organization), ''),
         COALESCE(p.author_id = auth.uid(), false),
         EXISTS (SELECT 1 FROM public.community_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid()),
         p.club_id, cl.name
  FROM public.community_posts p
  LEFT JOIN public.profiles pr ON pr.id = p.author_id
  LEFT JOIN public.community_clubs cl ON cl.id = p.club_id
  WHERE p.id = p_id
    AND (p.author_id = auth.uid() OR public.is_admin() OR (p.status = 'visible' AND public.community_can_see(p.club_id)));
$$;

CREATE OR REPLACE FUNCTION public.community_comments(p_post_id UUID)
RETURNS TABLE (id UUID, body TEXT, created_at TIMESTAMPTZ, author_name TEXT, author_organization TEXT, is_mine BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.body, c.created_at, public.review_author_name(c.author_id), NULLIF(trim(pr.organization), ''),
         COALESCE(c.author_id = auth.uid(), false)
  FROM public.community_comments c
  JOIN public.community_posts p ON p.id = c.post_id
   AND (p.author_id = auth.uid() OR public.is_admin() OR (p.status = 'visible' AND public.community_can_see(p.club_id)))
  LEFT JOIN public.profiles pr ON pr.id = c.author_id
  WHERE c.post_id = p_post_id AND (c.status = 'visible' OR c.author_id = auth.uid())
  ORDER BY c.created_at;
$$;

-- What the signed-in account may do today, now with clubs
DROP FUNCTION IF EXISTS public.my_community_limits();
CREATE OR REPLACE FUNCTION public.my_community_limits()
RETURNS TABLE (reports_left INTEGER, stories_left INTEGER, photos INTEGER, attachments BOOLEAN, banned BOOLEAN, clubs_left INTEGER, can_create_clubs BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE WHEN l.reports IS NULL THEN NULL ELSE greatest(l.reports - (SELECT count(*) FROM public.community_posts WHERE author_id = auth.uid() AND kind = 'report' AND created_at > now() - interval '1 day'), 0)::INTEGER END,
    CASE WHEN l.stories IS NULL THEN NULL ELSE greatest(l.stories - (SELECT count(*) FROM public.community_posts WHERE author_id = auth.uid() AND kind = 'story' AND created_at > now() - interval '1 day'), 0)::INTEGER END,
    l.photos, l.attachments,
    EXISTS (SELECT 1 FROM public.community_bans WHERE user_id = auth.uid() AND (until IS NULL OR until > now())),
    CASE WHEN cl.clubs IS NULL THEN NULL ELSE greatest(cl.clubs - (SELECT count(*) FROM public.community_clubs WHERE owner_id = auth.uid()), 0)::INTEGER END,
    cl.clubs IS NULL OR cl.clubs > 0
  FROM public.community_limits(auth.uid()) l, public.community_club_limits(auth.uid()) cl
  WHERE auth.uid() IS NOT NULL;
$$;

-- 6. Who may call what --------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.community_club_limits(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.community_assert_club_owner(UUID) FROM PUBLIC, anon, authenticated;
-- Used inside the reading functions, which anon may call; they reveal nothing on their own
GRANT EXECUTE ON FUNCTION public.community_is_member(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_can_see(UUID) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.create_community_club(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_community_club(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_community_club(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_community_club_member(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_community_club_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_community_clubs() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.community_club_members(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_community_post(TEXT, TEXT, TEXT, TEXT[], DATE, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_community_limits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_community_club(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_community_club(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_community_club(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_community_club_member(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_community_club_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_community_clubs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_club_members(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_community_post(TEXT, TEXT, TEXT, TEXT[], DATE, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_community_limits() TO authenticated;

REVOKE ALL ON FUNCTION public.community_feed(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.community_post(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_feed(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_post(UUID) TO anon, authenticated;
