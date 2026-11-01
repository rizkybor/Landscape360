-- Community Clubs, stage 3 (COMMUNITY_PRD.md §14.5): the club map.
--   * shared annotations: pins, lines, areas and notes members draw on the map (2D or 3D
--     terrain), with a label, a colour and comments. Not real time: the apps read them again
--     every 30 seconds while the club map is open.
--   * saved views: a named camera (centre, zoom, tilt, rotation, 2D/3D) for briefings
-- Every member adds; the author, the leader or an admin changes or removes. Analysis (profiles,
-- area, distance, height difference) is computed in the apps from the geometry.
-- Requires 20261102000029. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.community_club_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.community_clubs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('pin', 'line', 'area', 'note')),
  label TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  color TEXT NOT NULL DEFAULT '#d49b22' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  -- GeoJSON geometry: Point (pin, note), LineString (line) or Polygon (area)
  geometry JSONB NOT NULL CHECK (jsonb_typeof(geometry) = 'object' AND pg_column_size(geometry) <= 204800),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_club_annotations_club_idx ON public.community_club_annotations (club_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.community_club_annotation_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id UUID NOT NULL REFERENCES public.community_club_annotations(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_club_annotation_comments_idx ON public.community_club_annotation_comments (annotation_id, created_at);

CREATE TABLE IF NOT EXISTS public.community_club_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.community_clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  lng DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  lat DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  zoom REAL NOT NULL CHECK (zoom BETWEEN 0 AND 24),
  pitch REAL NOT NULL DEFAULT 0 CHECK (pitch BETWEEN 0 AND 85),
  bearing REAL NOT NULL DEFAULT 0 CHECK (bearing BETWEEN -360 AND 360),
  terrain BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_club_views_club_idx ON public.community_club_views (club_id, created_at);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['community_club_annotations', 'community_club_annotation_comments', 'community_club_views'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admin reads everything" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admin reads everything" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- The geometry matches the kind, with sane coordinates and at most 2000 vertices
CREATE OR REPLACE FUNCTION public.community_annotation_geometry_ok(p_kind TEXT, g JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  pts JSONB;
  pt JSONB;
BEGIN
  IF g IS NULL OR jsonb_typeof(g->'coordinates') <> 'array' THEN RETURN false; END IF;
  IF p_kind IN ('pin', 'note') THEN
    IF g->>'type' <> 'Point' THEN RETURN false; END IF;
    pts := jsonb_build_array(g->'coordinates');
  ELSIF p_kind = 'line' THEN
    IF g->>'type' <> 'LineString' OR jsonb_array_length(g->'coordinates') < 2 THEN RETURN false; END IF;
    pts := g->'coordinates';
  ELSE
    IF g->>'type' <> 'Polygon' OR jsonb_array_length(g->'coordinates') <> 1 OR jsonb_array_length(g->'coordinates'->0) < 4 THEN RETURN false; END IF;
    pts := g->'coordinates'->0;
  END IF;
  IF jsonb_array_length(pts) > 2000 THEN RETURN false; END IF;
  FOR pt IN SELECT * FROM jsonb_array_elements(pts) LOOP
    IF jsonb_typeof(pt) <> 'array' OR jsonb_typeof(pt->0) <> 'number' OR jsonb_typeof(pt->1) <> 'number'
       OR (pt->>0)::double precision NOT BETWEEN -180 AND 180 OR (pt->>1)::double precision NOT BETWEEN -90 AND 90 THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

-- Creates (p_id NULL: any member, up to 1000 per club) or changes one (its author, the leader or an admin)
CREATE OR REPLACE FUNCTION public.save_community_club_annotation(
  p_club_id UUID, p_id UUID, p_kind TEXT, p_label TEXT, p_note TEXT, p_color TEXT, p_geometry JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_label TEXT := left(public.community_clean(p_label), 80);
  v_id UUID := p_id;
  v_author UUID;
BEGIN
  PERFORM public.community_assert_can_write();
  IF NOT public.community_is_member(p_club_id) THEN RAISE EXCEPTION 'Only members can draw on the club map'; END IF;
  IF p_kind NOT IN ('pin', 'line', 'area', 'note') THEN RAISE EXCEPTION 'Unknown kind'; END IF;
  IF v_label IS NULL THEN RAISE EXCEPTION 'Give it a label'; END IF;
  IF NOT public.community_annotation_geometry_ok(p_kind, p_geometry) THEN RAISE EXCEPTION 'The shape on the map is not valid'; END IF;
  IF p_color IS NOT NULL AND p_color !~ '^#[0-9a-fA-F]{6}$' THEN RAISE EXCEPTION 'Unknown colour'; END IF;
  IF p_id IS NULL THEN
    IF (SELECT count(*) FROM public.community_club_annotations WHERE club_id = p_club_id) >= 1000 THEN
      RAISE EXCEPTION 'The club map is full (1000 drawings). Remove some first.';
    END IF;
    INSERT INTO public.community_club_annotations (club_id, kind, label, note, color, geometry, created_by)
    VALUES (p_club_id, p_kind, v_label, left(public.community_clean(p_note), 1000), COALESCE(p_color, '#d49b22'), p_geometry, auth.uid())
    RETURNING id INTO v_id;
  ELSE
    SELECT created_by INTO v_author FROM public.community_club_annotations WHERE id = p_id AND club_id = p_club_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
    IF v_author IS DISTINCT FROM auth.uid() THEN PERFORM public.community_assert_club_manager(p_club_id); END IF;
    UPDATE public.community_club_annotations
    SET kind = p_kind, label = v_label, note = left(public.community_clean(p_note), 1000), color = COALESCE(p_color, color),
        geometry = p_geometry, updated_at = now()
    WHERE id = p_id;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_community_club_annotation(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  a public.community_club_annotations%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.community_club_annotations WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF a.created_by IS DISTINCT FROM auth.uid() OR NOT public.community_is_member(a.club_id) THEN
    PERFORM public.community_assert_club_manager(a.club_id);
  END IF;
  DELETE FROM public.community_club_annotations WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_club_annotations(p_club_id UUID)
RETURNS TABLE (
  id UUID, kind TEXT, label TEXT, note TEXT, color TEXT, geometry JSONB, author_name TEXT, is_mine BOOLEAN,
  comment_count INTEGER, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id, a.kind, a.label, a.note, a.color, a.geometry, public.review_author_name(a.created_by), a.created_by = auth.uid(),
         (SELECT count(*) FROM public.community_club_annotation_comments c WHERE c.annotation_id = a.id)::INTEGER,
         a.created_at, a.updated_at
  FROM public.community_club_annotations a
  WHERE a.club_id = p_club_id AND (public.community_is_member(p_club_id) OR public.is_admin())
  ORDER BY a.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.add_community_club_annotation_comment(p_id UUID, p_body TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_club UUID;
  v_body TEXT := left(public.community_clean(p_body), 500);
  v_id UUID;
BEGIN
  PERFORM public.community_assert_can_write();
  SELECT club_id INTO v_club FROM public.community_club_annotations WHERE id = p_id;
  IF v_club IS NULL OR NOT public.community_is_member(v_club) THEN RAISE EXCEPTION 'Only members can comment'; END IF;
  IF v_body IS NULL THEN RAISE EXCEPTION 'Write a comment first'; END IF;
  INSERT INTO public.community_club_annotation_comments (annotation_id, author_id, body) VALUES (p_id, auth.uid(), v_body) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_community_club_annotation_comment(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c public.community_club_annotation_comments%ROWTYPE;
  v_club UUID;
BEGIN
  SELECT * INTO c FROM public.community_club_annotation_comments WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT club_id INTO v_club FROM public.community_club_annotations WHERE id = c.annotation_id;
  IF c.author_id IS DISTINCT FROM auth.uid() THEN PERFORM public.community_assert_club_manager(v_club); END IF;
  DELETE FROM public.community_club_annotation_comments WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_club_annotation_comments(p_id UUID)
RETURNS TABLE (id UUID, body TEXT, author_name TEXT, is_mine BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.body, public.review_author_name(c.author_id), c.author_id = auth.uid(), c.created_at
  FROM public.community_club_annotation_comments c
  JOIN public.community_club_annotations a ON a.id = c.annotation_id
  WHERE c.annotation_id = p_id AND (public.community_is_member(a.club_id) OR public.is_admin())
  ORDER BY c.created_at;
$$;

-- Saved views: any member saves (up to 50 per club); the author, the leader or an admin removes
CREATE OR REPLACE FUNCTION public.save_community_club_view(
  p_club_id UUID, p_name TEXT, p_lng DOUBLE PRECISION, p_lat DOUBLE PRECISION, p_zoom REAL, p_pitch REAL, p_bearing REAL, p_terrain BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name TEXT := left(public.community_clean(p_name), 60);
  v_id UUID;
BEGIN
  PERFORM public.community_assert_can_write();
  IF NOT public.community_is_member(p_club_id) THEN RAISE EXCEPTION 'Only members can save views'; END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Give the view a name'; END IF;
  IF (SELECT count(*) FROM public.community_club_views WHERE club_id = p_club_id) >= 50 THEN
    RAISE EXCEPTION 'A club can save up to 50 views';
  END IF;
  INSERT INTO public.community_club_views (club_id, name, lng, lat, zoom, pitch, bearing, terrain, created_by)
  VALUES (p_club_id, v_name, p_lng, p_lat, least(greatest(p_zoom, 0), 24), least(greatest(COALESCE(p_pitch, 0), 0), 85),
          COALESCE(p_bearing, 0), COALESCE(p_terrain, false), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_community_club_view(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v public.community_club_views%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.community_club_views WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF v.created_by IS DISTINCT FROM auth.uid() OR NOT public.community_is_member(v.club_id) THEN
    PERFORM public.community_assert_club_manager(v.club_id);
  END IF;
  DELETE FROM public.community_club_views WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_club_views(p_club_id UUID)
RETURNS TABLE (
  id UUID, name TEXT, lng DOUBLE PRECISION, lat DOUBLE PRECISION, zoom REAL, pitch REAL, bearing REAL, terrain BOOLEAN,
  author_name TEXT, is_mine BOOLEAN, created_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT v.id, v.name, v.lng, v.lat, v.zoom, v.pitch, v.bearing, v.terrain, public.review_author_name(v.created_by),
         v.created_by = auth.uid(), v.created_at
  FROM public.community_club_views v
  WHERE v.club_id = p_club_id AND (public.community_is_member(p_club_id) OR public.is_admin())
  ORDER BY v.created_at;
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'save_community_club_annotation(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB)', 'delete_community_club_annotation(UUID)',
    'community_club_annotations(UUID)', 'add_community_club_annotation_comment(UUID, TEXT)',
    'delete_community_club_annotation_comment(UUID)', 'community_club_annotation_comments(UUID)',
    'save_community_club_view(UUID, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, REAL, REAL, REAL, BOOLEAN)',
    'delete_community_club_view(UUID)', 'community_club_views(UUID)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
