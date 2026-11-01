-- Community Clubs: the club leader (its owner) edits the club's profile: name, description,
-- home base (region), contact and photo. The photo is in the community-photos bucket, in the
-- leader's folder: <user id>/club-<club id>-<time>.jpg. Requires 20261102000025. Safe to re-run until a later Community migration is applied.

-- Guard: a later Community migration replaces functions in this file; running this one again
-- after it would bring back older versions (for example a feed without the club rules).
DO $$
BEGIN
  IF to_regclass('public.community_club_invites') IS NOT NULL THEN
    RAISE EXCEPTION 'Community is already upgraded by 20261102000027 (club workspace). Do not run this older migration again; run the latest one instead.';
  END IF;
END $$;

ALTER TABLE public.community_clubs ADD COLUMN IF NOT EXISTS region TEXT CHECK (region IS NULL OR char_length(region) <= 80);
ALTER TABLE public.community_clubs ADD COLUMN IF NOT EXISTS contact TEXT CHECK (contact IS NULL OR char_length(contact) <= 200);
ALTER TABLE public.community_clubs ADD COLUMN IF NOT EXISTS photo_path TEXT
  CHECK (photo_path IS NULL OR photo_path ~ '^[0-9a-f-]{36}/club-[0-9a-f-]{36}-[0-9]+\.(jpg|webp)$');
ALTER TABLE public.community_clubs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Name, description, home base and contact (the leader, while Enterprise or admin)
DROP FUNCTION IF EXISTS public.update_community_club(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.update_community_club(p_id UUID, p_name TEXT, p_description TEXT, p_region TEXT DEFAULT NULL, p_contact TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name TEXT := left(public.community_clean(p_name), 60);
BEGIN
  PERFORM public.community_assert_club_owner(p_id);
  IF v_name IS NULL OR char_length(v_name) < 2 THEN RAISE EXCEPTION 'Give the club a name'; END IF;
  UPDATE public.community_clubs
  SET name = v_name,
      description = left(public.community_clean(p_description), 500),
      region = left(public.community_clean(p_region), 80),
      contact = left(public.community_clean(p_contact), 200),
      updated_at = now()
  WHERE id = p_id;
END;
$$;

-- Sets (or with NULL removes) the club photo; returns the previous file to remove from storage
CREATE OR REPLACE FUNCTION public.set_community_club_photo(p_id UUID, p_path TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old TEXT;
BEGIN
  PERFORM public.community_assert_club_owner(p_id);
  IF p_path IS NOT NULL AND p_path NOT LIKE auth.uid()::text || '/club-' || p_id::text || '-%' THEN
    RAISE EXCEPTION 'Wrong photo path';
  END IF;
  SELECT photo_path INTO v_old FROM public.community_clubs WHERE id = p_id;
  UPDATE public.community_clubs SET photo_path = p_path, updated_at = now() WHERE id = p_id;
  RETURN NULLIF(v_old, p_path);
END;
$$;

-- Deleting a club also returns its photo
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
  v_paths := v_paths || COALESCE((SELECT ARRAY[photo_path] FROM public.community_clubs WHERE id = p_id AND photo_path IS NOT NULL), '{}');
  DELETE FROM public.community_reports WHERE target_kind = 'post' AND target_id IN (SELECT id FROM public.community_posts WHERE club_id = p_id);
  DELETE FROM public.community_reports WHERE target_kind = 'comment' AND target_id IN (
    SELECT c.id FROM public.community_comments c JOIN public.community_posts p ON p.id = c.post_id WHERE p.club_id = p_id);
  DELETE FROM public.community_clubs WHERE id = p_id;
  RETURN COALESCE(v_paths, '{}');
END;
$$;

DROP FUNCTION IF EXISTS public.my_community_clubs();
CREATE OR REPLACE FUNCTION public.my_community_clubs()
RETURNS TABLE (
  id UUID, name TEXT, description TEXT, role TEXT, member_count INTEGER, owner_name TEXT, created_at TIMESTAMPTZ,
  region TEXT, contact TEXT, photo_path TEXT, updated_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name, c.description, m.role,
         (SELECT count(*) FROM public.community_club_members x WHERE x.club_id = c.id)::INTEGER,
         public.review_author_name(c.owner_id), c.created_at,
         c.region, c.contact, c.photo_path, c.updated_at
  FROM public.community_club_members m
  JOIN public.community_clubs c ON c.id = m.club_id
  WHERE m.user_id = auth.uid()
  ORDER BY (m.role = 'owner') DESC, c.name;
$$;

REVOKE ALL ON FUNCTION public.update_community_club(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_community_club_photo(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_community_clubs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_community_club(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_community_club_photo(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_community_clubs() TO authenticated;
