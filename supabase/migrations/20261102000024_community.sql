-- Community (COMMUNITY_PRD.md): trail reports and trip stories pinned to the map, with photos,
-- map data snapshots (track, area, place) or a Classic Field Work link, "Helpful" reactions,
-- comments, reports and admin moderation. Anyone can read what is visible (no sign-in); every
-- signed-in account can post within daily limits per plan. All writes go through the functions
-- below; the tables are not written from the browser. Requires review_author_name()
-- (20261024000007), profiles.organization (20261024000009) and is_admin(). Safe to re-run until a later Community migration is applied.

-- Guard: a later Community migration replaces functions in this file; running this one again
-- after it would bring back older versions (for example a feed without the club rules).
DO $$
BEGIN
  IF to_regclass('public.community_clubs') IS NOT NULL THEN
    RAISE EXCEPTION 'Community is already upgraded by 20261102000025 (clubs). Do not run this older migration again; run the latest one instead.';
  END IF;
END $$;

-- 1. Tables ----------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('report', 'story')),
  title TEXT CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 80),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  conditions TEXT[] NOT NULL DEFAULT '{}',
  happened_on DATE NOT NULL DEFAULT current_date,
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  place_name TEXT CHECK (place_name IS NULL OR char_length(place_name) <= 120),
  -- { kind: track | area | place, name, geometry, … } or { kind: classic, token, name }
  attachment JSONB CHECK (attachment IS NULL OR (jsonb_typeof(attachment) = 'object' AND pg_column_size(attachment) <= 204800)),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'removed')),
  helpful_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS community_posts_recent_idx ON public.community_posts (created_at DESC) WHERE status = 'visible';
CREATE INDEX IF NOT EXISTS community_posts_place_idx ON public.community_posts (lat, lng) WHERE status = 'visible';
CREATE INDEX IF NOT EXISTS community_posts_author_idx ON public.community_posts (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.community_photos (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  path TEXT NOT NULL CHECK (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}-[0-9]\.(jpg|webp)$'),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 4096),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 4096),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 716800),
  position SMALLINT NOT NULL CHECK (position BETWEEN 0 AND 3),
  PRIMARY KEY (post_id, position)
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'removed')),
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_comments_post_idx ON public.community_comments (post_id, created_at);

CREATE TABLE IF NOT EXISTS public.community_reactions (
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_kind TEXT NOT NULL CHECK (target_kind IN ('post', 'comment')),
  target_id UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('misleading', 'spam', 'inappropriate', 'privacy', 'other')),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (target_kind, target_id, reporter_id)
);

CREATE TABLE IF NOT EXISTS public.community_bans (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  until TIMESTAMPTZ, -- NULL: until lifted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only through the functions below (and the admin, who may read everything)
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_bans ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['community_posts', 'community_photos', 'community_comments', 'community_reactions', 'community_reports', 'community_bans'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admin reads everything" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admin reads everything" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- 2. Photos bucket: anyone can view; each account writes only in its own folder -------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('community-photos', 'community-photos', true, 716800, ARRAY['image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = true, file_size_limit = 716800, allowed_mime_types = ARRAY['image/jpeg', 'image/webp'];

DROP POLICY IF EXISTS "Community photos: upload to own folder" ON storage.objects;
CREATE POLICY "Community photos: upload to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Community photos: delete own or (admin) any" ON storage.objects;
CREATE POLICY "Community photos: delete own or (admin) any" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'community-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));

-- 3. Helpers ----------------------------------------------------------------------------------

-- Daily limits per plan (admin: none). Keep in sync with src/lib/community.ts and the app.
CREATE OR REPLACE FUNCTION public.community_limits(p_user_id UUID)
RETURNS TABLE (reports INTEGER, stories INTEGER, photos INTEGER, attachments BOOLEAN, comments INTEGER, is_admin BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE WHEN p.is_admin THEN NULL WHEN p.status_subscribe = 'Enterprise' THEN 50 WHEN p.status_subscribe = 'Pro' THEN 20 ELSE 5 END,
    CASE WHEN p.is_admin THEN NULL WHEN p.status_subscribe = 'Enterprise' THEN 20 WHEN p.status_subscribe = 'Pro' THEN 5 ELSE 1 END,
    CASE WHEN p.is_admin OR p.status_subscribe IN ('Pro', 'Enterprise') THEN 4 ELSE 1 END,
    COALESCE(p.is_admin OR p.status_subscribe IN ('Pro', 'Enterprise'), false),
    CASE WHEN p.is_admin THEN NULL ELSE 100 END,
    COALESCE(p.is_admin, false)
  FROM (SELECT 1) one
  LEFT JOIN public.profiles p ON p.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.community_assert_can_write()
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to post in Community';
  END IF;
  IF EXISTS (SELECT 1 FROM public.community_bans WHERE user_id = auth.uid() AND (until IS NULL OR until > now())) THEN
    RAISE EXCEPTION 'You cannot post in Community at the moment. Contact us if you think this is a mistake.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_clean(p_text TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  -- No markup: text only, trimmed, at most two blank lines in a row
  SELECT NULLIF(regexp_replace(trim(regexp_replace(COALESCE(p_text, ''), '<[^>]*>', '', 'g')), '\n{3,}', E'\n\n', 'g'), '');
$$;

CREATE OR REPLACE FUNCTION public.community_conditions_ok(p_conditions TEXT[])
RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(cardinality(p_conditions), 0) <= 4
     AND COALESCE(p_conditions, '{}') <@ ARRAY['safe', 'muddy', 'landslide', 'fallen_tree', 'water_ok', 'water_dry',
                                                'closed', 'bad_weather', 'wildlife', 'other'];
$$;

-- 4. Posts ------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_community_post(
  p_kind TEXT, p_title TEXT, p_body TEXT, p_conditions TEXT[], p_happened_on DATE,
  p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_place_name TEXT, p_attachment JSONB
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

  -- Daily limit per type (last 24 hours)
  SELECT count(*) INTO v_today FROM public.community_posts
  WHERE author_id = auth.uid() AND kind = p_kind AND created_at > now() - interval '1 day';
  IF (p_kind = 'report' AND lim.reports IS NOT NULL AND v_today >= lim.reports)
     OR (p_kind = 'story' AND lim.stories IS NOT NULL AND v_today >= lim.stories) THEN
    RAISE EXCEPTION 'You have reached today''s limit of % for your plan. Try again tomorrow.',
      CASE WHEN p_kind = 'report' THEN lim.reports || ' trail reports' ELSE lim.stories || ' stories' END;
  END IF;

  INSERT INTO public.community_posts (author_id, kind, title, body, conditions, happened_on, lat, lng, place_name, attachment)
  VALUES (auth.uid(), p_kind, left(v_title, 80), v_body, COALESCE(p_conditions, '{}'), p_happened_on, p_lat, p_lng,
          left(public.community_clean(p_place_name), 120), p_attachment)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- The author may edit the text for 24 hours (shown as "edited")
CREATE OR REPLACE FUNCTION public.update_community_post(p_id UUID, p_title TEXT, p_body TEXT, p_conditions TEXT[], p_place_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  post public.community_posts%ROWTYPE;
  v_body TEXT := public.community_clean(p_body);
BEGIN
  PERFORM public.community_assert_can_write();
  SELECT * INTO post FROM public.community_posts WHERE id = p_id AND author_id = auth.uid() AND status <> 'removed';
  IF NOT FOUND THEN RAISE EXCEPTION 'You can only edit your own posts'; END IF;
  IF post.created_at < now() - interval '1 day' THEN RAISE EXCEPTION 'Posts can be edited for 24 hours'; END IF;
  IF v_body IS NULL THEN RAISE EXCEPTION 'Write something first'; END IF;
  IF post.kind = 'report' AND char_length(v_body) > 500 THEN RAISE EXCEPTION 'A trail report is at most 500 characters'; END IF;
  IF post.kind = 'report' AND COALESCE(cardinality(p_conditions), 0) = 0 THEN RAISE EXCEPTION 'Choose at least one trail condition'; END IF;
  IF NOT public.community_conditions_ok(p_conditions) THEN RAISE EXCEPTION 'Unknown trail condition'; END IF;
  UPDATE public.community_posts
  SET title = left(public.community_clean(p_title), 80), body = v_body, conditions = COALESCE(p_conditions, '{}'),
      place_name = left(public.community_clean(p_place_name), 120), edited_at = now()
  WHERE id = p_id;
END;
$$;

-- Deletes the author's post (and its comments, reactions, reports); returns the photo files to remove
CREATE OR REPLACE FUNCTION public.delete_community_post(p_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_paths TEXT[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.community_posts WHERE id = p_id AND author_id = auth.uid()) THEN
    RAISE EXCEPTION 'You can only delete your own posts';
  END IF;
  SELECT COALESCE(array_agg(path), '{}') INTO v_paths FROM public.community_photos WHERE post_id = p_id;
  DELETE FROM public.community_reports WHERE target_kind = 'post' AND target_id = p_id;
  DELETE FROM public.community_reports WHERE target_kind = 'comment' AND target_id IN (SELECT id FROM public.community_comments WHERE post_id = p_id);
  DELETE FROM public.community_posts WHERE id = p_id;
  RETURN v_paths;
END;
$$;

-- A photo uploaded to <user id>/<post id>-<n>.jpg, recorded on the author's post
CREATE OR REPLACE FUNCTION public.add_community_photo(p_post_id UUID, p_path TEXT, p_width INTEGER, p_height INTEGER, p_size INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  lim RECORD;
  v_count INTEGER;
BEGIN
  PERFORM public.community_assert_can_write();
  IF NOT EXISTS (SELECT 1 FROM public.community_posts WHERE id = p_post_id AND author_id = auth.uid()) THEN
    RAISE EXCEPTION 'You can only add photos to your own posts';
  END IF;
  IF split_part(p_path, '/', 1) <> auth.uid()::text OR split_part(split_part(p_path, '/', 2), '-', 1) = '' OR position(p_post_id::text IN p_path) = 0 THEN
    RAISE EXCEPTION 'Wrong photo path';
  END IF;
  SELECT * INTO lim FROM public.community_limits(auth.uid());
  SELECT count(*) INTO v_count FROM public.community_photos WHERE post_id = p_post_id;
  IF v_count >= lim.photos THEN
    RAISE EXCEPTION 'Your plan allows % photo(s) per post', lim.photos;
  END IF;
  INSERT INTO public.community_photos (post_id, path, width, height, size_bytes, position)
  VALUES (p_post_id, p_path, p_width, p_height, p_size, v_count);
END;
$$;

-- 5. Helpful, comments, reports -----------------------------------------------------------

CREATE OR REPLACE FUNCTION public.toggle_community_helpful(p_post_id UUID)
RETURNS TABLE (helpful BOOLEAN, helpful_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_posts WHERE id = p_post_id AND status = 'visible') THEN
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
  IF NOT EXISTS (SELECT 1 FROM public.community_posts WHERE id = p_post_id AND status = 'visible') THEN
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

CREATE OR REPLACE FUNCTION public.delete_community_comment(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c public.community_comments%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.community_comments WHERE id = p_id;
  IF NOT FOUND OR (c.author_id <> auth.uid() AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'You can only delete your own comments';
  END IF;
  DELETE FROM public.community_reports WHERE target_kind = 'comment' AND target_id = p_id;
  DELETE FROM public.community_comments WHERE id = p_id;
  IF c.status = 'visible' THEN
    UPDATE public.community_posts SET comment_count = greatest(comment_count - 1, 0) WHERE id = c.post_id;
  END IF;
END;
$$;

-- One report per account and item; three from different accounts hide it until the admin looks
CREATE OR REPLACE FUNCTION public.report_community(p_kind TEXT, p_id UUID, p_reason TEXT, p_note TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_old TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to report'; END IF;
  IF p_kind = 'post' AND NOT EXISTS (SELECT 1 FROM public.community_posts WHERE id = p_id) THEN RAISE EXCEPTION 'Not found'; END IF;
  IF p_kind = 'comment' AND NOT EXISTS (SELECT 1 FROM public.community_comments WHERE id = p_id) THEN RAISE EXCEPTION 'Not found'; END IF;
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
    -- A comment hidden by this report no longer counts on its post
    IF v_old = 'visible' AND v_count >= 3 THEN
      UPDATE public.community_posts SET comment_count = greatest(comment_count - 1, 0)
      WHERE id = (SELECT post_id FROM public.community_comments WHERE id = p_id);
    END IF;
  END IF;
END;
$$;

-- 6. Admin moderation ----------------------------------------------------------------------

-- restore: visible again, reports cleared · hide: out of sight · remove: gone (kept for the record)
CREATE OR REPLACE FUNCTION public.moderate_community(p_kind TEXT, p_id UUID, p_action TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status TEXT := CASE p_action WHEN 'restore' THEN 'visible' WHEN 'hide' THEN 'hidden' WHEN 'remove' THEN 'removed' END;
  v_old TEXT;
  v_post UUID;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only the admin can moderate Community'; END IF;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Unknown action'; END IF;
  IF p_kind = 'post' THEN
    UPDATE public.community_posts
    SET status = v_status, report_count = CASE WHEN p_action = 'restore' THEN 0 ELSE report_count END
    WHERE id = p_id;
  ELSE
    SELECT status, post_id INTO v_old, v_post FROM public.community_comments WHERE id = p_id;
    UPDATE public.community_comments
    SET status = v_status, report_count = CASE WHEN p_action = 'restore' THEN 0 ELSE report_count END
    WHERE id = p_id;
    -- Keep the post's comment count to visible comments
    IF v_old = 'visible' AND v_status <> 'visible' THEN
      UPDATE public.community_posts SET comment_count = greatest(comment_count - 1, 0) WHERE id = v_post;
    ELSIF v_old <> 'visible' AND v_status = 'visible' THEN
      UPDATE public.community_posts SET comment_count = comment_count + 1 WHERE id = v_post;
    END IF;
  END IF;
  UPDATE public.community_reports SET resolved_at = now()
  WHERE target_kind = p_kind AND target_id = p_id AND resolved_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_community_ban(p_user_id UUID, p_reason TEXT, p_days INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only the admin can block accounts'; END IF;
  IF p_days IS NULL THEN
    INSERT INTO public.community_bans (user_id, reason, until) VALUES (p_user_id, p_reason, NULL)
    ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, until = NULL, created_at = now();
  ELSIF p_days <= 0 THEN
    DELETE FROM public.community_bans WHERE user_id = p_user_id;
  ELSE
    INSERT INTO public.community_bans (user_id, reason, until) VALUES (p_user_id, p_reason, now() + make_interval(days => p_days))
    ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, until = EXCLUDED.until, created_at = now();
  END IF;
END;
$$;

-- Reported items waiting for the admin, most reported first
CREATE OR REPLACE FUNCTION public.community_report_queue()
RETURNS TABLE (
  target_kind TEXT, target_id UUID, post_id UUID, status TEXT, excerpt TEXT, author_id UUID, author_name TEXT,
  reports INTEGER, reasons TEXT[], notes TEXT[], last_reported_at TIMESTAMPTZ, author_banned BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.target_kind, r.target_id,
         COALESCE(p.id, c.post_id),
         COALESCE(p.status, c.status),
         left(COALESCE(p.title || ': ', '') || COALESCE(p.body, c.body), 200),
         COALESCE(p.author_id, c.author_id),
         public.review_author_name(COALESCE(p.author_id, c.author_id)),
         count(*)::INTEGER,
         array_agg(DISTINCT r.reason),
         array_remove(array_agg(r.note), NULL),
         max(r.created_at),
         EXISTS (SELECT 1 FROM public.community_bans b WHERE b.user_id = COALESCE(p.author_id, c.author_id) AND (b.until IS NULL OR b.until > now()))
  FROM public.community_reports r
  LEFT JOIN public.community_posts p ON r.target_kind = 'post' AND p.id = r.target_id
  LEFT JOIN public.community_comments c ON r.target_kind = 'comment' AND c.id = r.target_id
  WHERE r.resolved_at IS NULL AND public.is_admin() AND (p.id IS NOT NULL OR c.id IS NOT NULL)
  GROUP BY r.target_kind, r.target_id, p.id, p.status, p.title, p.body, p.author_id, c.post_id, c.status, c.body, c.author_id
  ORDER BY count(*) DESC, max(r.created_at) DESC;
$$;

-- 7. Reading (anyone) -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.community_post_photos(p_post_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('path', path, 'width', width, 'height', height) ORDER BY position), '[]'::jsonb)
  FROM public.community_photos WHERE post_id = p_post_id;
$$;

-- Newest first; optional box (map view), kinds, conditions, since; `before` pages back.
-- Stories come with the first 280 characters only (the full text is in community_post).
CREATE OR REPLACE FUNCTION public.community_feed(
  p_west DOUBLE PRECISION DEFAULT NULL, p_south DOUBLE PRECISION DEFAULT NULL,
  p_east DOUBLE PRECISION DEFAULT NULL, p_north DOUBLE PRECISION DEFAULT NULL,
  p_kinds TEXT[] DEFAULT NULL, p_conditions TEXT[] DEFAULT NULL,
  p_since TIMESTAMPTZ DEFAULT NULL, p_before TIMESTAMPTZ DEFAULT NULL, p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID, kind TEXT, title TEXT, body TEXT, truncated BOOLEAN, conditions TEXT[], happened_on DATE,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION, place_name TEXT, attachment_kind TEXT, photos JSONB,
  helpful_count INTEGER, comment_count INTEGER, created_at TIMESTAMPTZ, edited_at TIMESTAMPTZ,
  author_name TEXT, author_organization TEXT, is_mine BOOLEAN, i_found_helpful BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.kind, p.title, left(p.body, 280), char_length(p.body) > 280, p.conditions, p.happened_on,
         p.lat, p.lng, p.place_name, p.attachment->>'kind', public.community_post_photos(p.id),
         p.helpful_count, p.comment_count, p.created_at, p.edited_at,
         public.review_author_name(p.author_id), NULLIF(trim(pr.organization), ''),
         COALESCE(p.author_id = auth.uid(), false),
         EXISTS (SELECT 1 FROM public.community_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid())
  FROM public.community_posts p
  LEFT JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.status = 'visible'
    AND (p_west IS NULL OR (p.lng BETWEEN p_west AND p_east AND p.lat BETWEEN p_south AND p_north))
    AND (p_kinds IS NULL OR p.kind = ANY (p_kinds))
    AND (p_conditions IS NULL OR p.conditions && p_conditions)
    AND (p_since IS NULL OR p.created_at >= p_since)
    AND (p_before IS NULL OR p.created_at < p_before)
  ORDER BY p.created_at DESC
  LIMIT least(greatest(COALESCE(p_limit, 20), 1), 300);
$$;

-- One post in full (visible, or the author's own / the admin's view of a hidden one)
CREATE OR REPLACE FUNCTION public.community_post(p_id UUID)
RETURNS TABLE (
  id UUID, kind TEXT, title TEXT, body TEXT, conditions TEXT[], happened_on DATE,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION, place_name TEXT, attachment JSONB, photos JSONB,
  helpful_count INTEGER, comment_count INTEGER, created_at TIMESTAMPTZ, edited_at TIMESTAMPTZ, status TEXT,
  author_name TEXT, author_organization TEXT, is_mine BOOLEAN, i_found_helpful BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.kind, p.title, p.body, p.conditions, p.happened_on, p.lat, p.lng, p.place_name, p.attachment,
         public.community_post_photos(p.id), p.helpful_count, p.comment_count, p.created_at, p.edited_at, p.status,
         public.review_author_name(p.author_id), NULLIF(trim(pr.organization), ''),
         COALESCE(p.author_id = auth.uid(), false),
         EXISTS (SELECT 1 FROM public.community_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid())
  FROM public.community_posts p
  LEFT JOIN public.profiles pr ON pr.id = p.author_id
  WHERE p.id = p_id AND (p.status = 'visible' OR p.author_id = auth.uid() OR public.is_admin());
$$;

CREATE OR REPLACE FUNCTION public.community_comments(p_post_id UUID)
RETURNS TABLE (id UUID, body TEXT, created_at TIMESTAMPTZ, author_name TEXT, author_organization TEXT, is_mine BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.body, c.created_at, public.review_author_name(c.author_id), NULLIF(trim(pr.organization), ''),
         COALESCE(c.author_id = auth.uid(), false)
  FROM public.community_comments c
  JOIN public.community_posts p ON p.id = c.post_id AND (p.status = 'visible' OR p.author_id = auth.uid() OR public.is_admin())
  LEFT JOIN public.profiles pr ON pr.id = c.author_id
  WHERE c.post_id = p_post_id AND (c.status = 'visible' OR c.author_id = auth.uid())
  ORDER BY c.created_at;
$$;

-- What the signed-in account may do today (for the compose form)
CREATE OR REPLACE FUNCTION public.my_community_limits()
RETURNS TABLE (reports_left INTEGER, stories_left INTEGER, photos INTEGER, attachments BOOLEAN, banned BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE WHEN l.reports IS NULL THEN NULL ELSE greatest(l.reports - (SELECT count(*) FROM public.community_posts WHERE author_id = auth.uid() AND kind = 'report' AND created_at > now() - interval '1 day'), 0)::INTEGER END,
    CASE WHEN l.stories IS NULL THEN NULL ELSE greatest(l.stories - (SELECT count(*) FROM public.community_posts WHERE author_id = auth.uid() AND kind = 'story' AND created_at > now() - interval '1 day'), 0)::INTEGER END,
    l.photos, l.attachments,
    EXISTS (SELECT 1 FROM public.community_bans WHERE user_id = auth.uid() AND (until IS NULL OR until > now()))
  FROM public.community_limits(auth.uid()) l
  WHERE auth.uid() IS NOT NULL;
$$;

-- 8. Who may call what --------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.community_limits(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.community_assert_can_write() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.community_post_photos(UUID) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_community_post(TEXT, TEXT, TEXT, TEXT[], DATE, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_community_post(UUID, TEXT, TEXT, TEXT[], TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_community_post(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_community_photo(UUID, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_community_helpful(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_community_comment(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_community_comment(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_community(TEXT, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moderate_community(TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_community_ban(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.community_report_queue() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_community_limits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_community_post(TEXT, TEXT, TEXT, TEXT[], DATE, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_community_post(UUID, TEXT, TEXT, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_community_post(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_community_photo(UUID, TEXT, INTEGER, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_community_helpful(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_community_comment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_community_comment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_community(TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_community(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_community_ban(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_report_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_community_limits() TO authenticated;

REVOKE ALL ON FUNCTION public.community_feed(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.community_post(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.community_comments(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_feed(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_post(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_comments(UUID) TO anon, authenticated;
