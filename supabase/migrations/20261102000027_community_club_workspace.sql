-- Community Clubs, stage 1 (COMMUNITY_PRD.md §14.2–14.3):
--   * roles: owner (leader), admin (pengurus), member; the leader names admins
--   * invite links (7 days, can be revoked): a signed-in account that opens one joins
--   * the club workspace: folders and items (copies of members' tracks, areas, places and
--     Classic Field Works) that every member sees, shows on the map and exports
--   * pinned announcements (up to 3 per club) and "new posts" since the member last looked
-- Managing (members, links, folders, pins) needs the leader to still be Enterprise (or admin),
-- like editing the club. Requires 20261102000026. Safe to re-run.

-- 1. Roles -------------------------------------------------------------------------------------

ALTER TABLE public.community_club_members DROP CONSTRAINT IF EXISTS community_club_members_role_check;
ALTER TABLE public.community_club_members ADD CONSTRAINT community_club_members_role_check CHECK (role IN ('owner', 'admin', 'member'));

-- The caller's role in a club (NULL: not a member)
CREATE OR REPLACE FUNCTION public.community_club_role(p_club_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.community_club_members WHERE club_id = p_club_id AND user_id = auth.uid();
$$;

-- The leader or an admin, while the leader may still own clubs
CREATE OR REPLACE FUNCTION public.community_assert_club_manager(p_club_id UUID)
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  IF COALESCE(public.community_club_role(p_club_id), '') NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only the club leader or an admin can do this';
  END IF;
  IF (SELECT l.clubs FROM public.community_clubs c, public.community_club_limits(c.owner_id) l WHERE c.id = p_club_id) = 0 THEN
    RAISE EXCEPTION 'The club leader needs an Enterprise account to manage the club';
  END IF;
END;
$$;

-- The leader makes a member an admin, or an admin a member again
CREATE OR REPLACE FUNCTION public.set_community_club_role(p_club_id UUID, p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.community_assert_club_owner(p_club_id);
  IF p_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'Unknown role'; END IF;
  UPDATE public.community_club_members SET role = p_role WHERE club_id = p_club_id AND user_id = p_user_id AND role <> 'owner';
  IF NOT FOUND THEN RAISE EXCEPTION 'Not a member of this club'; END IF;
END;
$$;

-- Admins add members too
CREATE OR REPLACE FUNCTION public.add_community_club_member(p_club_id UUID, p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_max INTEGER;
BEGIN
  PERFORM public.community_assert_club_manager(p_club_id);
  SELECT id INTO v_user FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_user IS NULL THEN RAISE EXCEPTION 'No Landscape 360 account uses that email'; END IF;
  IF EXISTS (SELECT 1 FROM public.community_club_members WHERE club_id = p_club_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'This account is already a member';
  END IF;
  SELECT l.members INTO v_max FROM public.community_clubs c, public.community_club_limits(c.owner_id) l WHERE c.id = p_club_id;
  IF (SELECT count(*) FROM public.community_club_members WHERE club_id = p_club_id) >= v_max THEN
    RAISE EXCEPTION 'A club can have up to % members', v_max;
  END IF;
  INSERT INTO public.community_club_members (club_id, user_id, role, added_by) VALUES (p_club_id, v_user, 'member', auth.uid());
  RETURN public.review_author_name(v_user);
END;
$$;

-- The leader removes anyone but themself; an admin removes members (not admins); anyone leaves
CREATE OR REPLACE FUNCTION public.remove_community_club_member(p_club_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_target TEXT;
  v_me TEXT := public.community_club_role(p_club_id);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  SELECT role INTO v_target FROM public.community_club_members WHERE club_id = p_club_id AND user_id = p_user_id;
  IF v_target IS NULL THEN RETURN; END IF;
  IF v_target = 'owner' THEN RAISE EXCEPTION 'The leader cannot leave the club. Delete the club instead.'; END IF;
  IF p_user_id <> auth.uid() THEN
    IF v_me = 'owner' THEN
      NULL;
    ELSIF v_me = 'admin' AND v_target = 'member' THEN
      PERFORM public.community_assert_club_manager(p_club_id);
    ELSE
      RAISE EXCEPTION 'Only the club leader or an admin can remove members';
    END IF;
  END IF;
  DELETE FROM public.community_club_members WHERE club_id = p_club_id AND user_id = p_user_id;
END;
$$;

-- Emails: the leader and admins (they add members by email)
CREATE OR REPLACE FUNCTION public.community_club_members(p_club_id UUID)
RETURNS TABLE (user_id UUID, name TEXT, organization TEXT, email TEXT, role TEXT, added_at TIMESTAMPTZ, is_me BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.user_id, public.review_author_name(m.user_id), NULLIF(trim(pr.organization), ''),
         CASE WHEN public.community_club_role(p_club_id) IN ('owner', 'admin') THEN pr.email END,
         m.role, m.created_at, m.user_id = auth.uid()
  FROM public.community_club_members m
  LEFT JOIN public.profiles pr ON pr.id = m.user_id
  WHERE m.club_id = p_club_id AND (public.community_is_member(p_club_id) OR public.is_admin())
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at;
$$;

-- 2. Invite links --------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_club_invites (
  token TEXT PRIMARY KEY CHECK (token ~ '^[0-9a-f]{32}$'),
  club_id UUID NOT NULL REFERENCES public.community_clubs(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  uses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_club_invites_club_idx ON public.community_club_invites (club_id);

CREATE OR REPLACE FUNCTION public.create_community_club_invite(p_club_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token TEXT := replace(gen_random_uuid()::text, '-', '');
BEGIN
  PERFORM public.community_assert_club_manager(p_club_id);
  IF (SELECT count(*) FROM public.community_club_invites WHERE club_id = p_club_id AND revoked_at IS NULL AND expires_at > now()) >= 10 THEN
    RAISE EXCEPTION 'A club can have up to 10 active invite links. Stop one first.';
  END IF;
  INSERT INTO public.community_club_invites (token, club_id, created_by, expires_at) VALUES (v_token, p_club_id, auth.uid(), now() + interval '7 days');
  RETURN v_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_community_club_invite(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_club UUID;
BEGIN
  SELECT club_id INTO v_club FROM public.community_club_invites WHERE token = p_token;
  IF v_club IS NULL THEN RAISE EXCEPTION 'Link not found'; END IF;
  PERFORM public.community_assert_club_manager(v_club);
  UPDATE public.community_club_invites SET revoked_at = now() WHERE token = p_token AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_club_invites(p_club_id UUID)
RETURNS TABLE (token TEXT, expires_at TIMESTAMPTZ, uses INTEGER, created_by_name TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.token, i.expires_at, i.uses, public.review_author_name(i.created_by), i.created_at
  FROM public.community_club_invites i
  WHERE i.club_id = p_club_id AND i.revoked_at IS NULL AND i.expires_at > now()
    AND public.community_club_role(p_club_id) IN ('owner', 'admin')
  ORDER BY i.created_at DESC;
$$;

-- What a link leads to, before joining (anyone with the link)
CREATE OR REPLACE FUNCTION public.community_club_invite_info(p_token TEXT)
RETURNS TABLE (club_id UUID, name TEXT, description TEXT, region TEXT, photo_path TEXT, member_count INTEGER, leader_name TEXT, valid BOOLEAN, is_member BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name, c.description, c.region, c.photo_path,
         (SELECT count(*) FROM public.community_club_members x WHERE x.club_id = c.id)::INTEGER,
         public.review_author_name(c.owner_id),
         i.revoked_at IS NULL AND i.expires_at > now(),
         COALESCE(public.community_is_member(c.id), false)
  FROM public.community_club_invites i
  JOIN public.community_clubs c ON c.id = i.club_id
  WHERE i.token = p_token;
$$;

CREATE OR REPLACE FUNCTION public.join_community_club(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv public.community_club_invites%ROWTYPE;
  v_max INTEGER;
BEGIN
  PERFORM public.community_assert_can_write();
  SELECT * INTO inv FROM public.community_club_invites WHERE token = p_token;
  IF NOT FOUND OR inv.revoked_at IS NOT NULL OR inv.expires_at <= now() THEN
    RAISE EXCEPTION 'This invite link has expired or was stopped. Ask the club for a new one.';
  END IF;
  IF public.community_is_member(inv.club_id) THEN RETURN inv.club_id; END IF;
  SELECT l.members INTO v_max FROM public.community_clubs c, public.community_club_limits(c.owner_id) l WHERE c.id = inv.club_id;
  IF (SELECT count(*) FROM public.community_club_members WHERE club_id = inv.club_id) >= v_max THEN
    RAISE EXCEPTION 'This club is full (% members)', v_max;
  END IF;
  INSERT INTO public.community_club_members (club_id, user_id, role, added_by) VALUES (inv.club_id, auth.uid(), 'member', inv.created_by);
  UPDATE public.community_club_invites SET uses = uses + 1 WHERE token = p_token;
  RETURN inv.club_id;
END;
$$;

-- 3. Workspace ---------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.community_club_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.community_clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_club_folders_club_idx ON public.community_club_folders (club_id);

CREATE TABLE IF NOT EXISTS public.community_club_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.community_clubs(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES public.community_club_folders(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('track', 'area', 'place', 'classic')),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  -- Same format as a post attachment: { kind, name, geometry, … } or { kind: classic, token, name }
  data JSONB NOT NULL CHECK (jsonb_typeof(data) = 'object' AND pg_column_size(data) <= 2097152),
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS community_club_items_club_idx ON public.community_club_items (club_id, created_at DESC);

ALTER TABLE public.community_club_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_club_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_club_items ENABLE ROW LEVEL SECURITY;

-- Any member adds a copy of their own map data
CREATE OR REPLACE FUNCTION public.add_community_club_item(p_club_id UUID, p_folder_id UUID, p_data JSONB, p_note TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_name TEXT := left(public.community_clean(p_data->>'name'), 120);
BEGIN
  PERFORM public.community_assert_can_write();
  IF NOT public.community_is_member(p_club_id) THEN RAISE EXCEPTION 'Only members can add to the workspace'; END IF;
  IF p_data IS NULL OR p_data->>'kind' NOT IN ('track', 'area', 'place', 'classic') THEN RAISE EXCEPTION 'Unknown item'; END IF;
  IF p_folder_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.community_club_folders WHERE id = p_folder_id AND club_id = p_club_id) THEN
    RAISE EXCEPTION 'Folder not found';
  END IF;
  IF (SELECT count(*) FROM public.community_club_items WHERE club_id = p_club_id) >= 500 THEN
    RAISE EXCEPTION 'The workspace is full (500 items). Remove some first.';
  END IF;
  INSERT INTO public.community_club_items (club_id, folder_id, kind, name, note, data, added_by)
  VALUES (p_club_id, p_folder_id, p_data->>'kind', COALESCE(v_name, 'Untitled'), left(public.community_clean(p_note), 500), p_data, auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Whoever added it, the leader or an admin: rename, note, move to a folder
CREATE OR REPLACE FUNCTION public.update_community_club_item(p_id UUID, p_name TEXT, p_note TEXT, p_folder_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it public.community_club_items%ROWTYPE;
  v_name TEXT := left(public.community_clean(p_name), 120);
BEGIN
  SELECT * INTO it FROM public.community_club_items WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  IF it.added_by IS DISTINCT FROM auth.uid() THEN PERFORM public.community_assert_club_manager(it.club_id);
  ELSIF NOT public.community_is_member(it.club_id) THEN RAISE EXCEPTION 'Only members can change the workspace';
  END IF;
  IF v_name IS NULL THEN RAISE EXCEPTION 'Give it a name'; END IF;
  IF p_folder_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.community_club_folders WHERE id = p_folder_id AND club_id = it.club_id) THEN
    RAISE EXCEPTION 'Folder not found';
  END IF;
  UPDATE public.community_club_items
  SET name = v_name, note = left(public.community_clean(p_note), 500), folder_id = p_folder_id, updated_at = now()
  WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_community_club_item(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  it public.community_club_items%ROWTYPE;
BEGIN
  SELECT * INTO it FROM public.community_club_items WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF it.added_by IS DISTINCT FROM auth.uid() OR NOT public.community_is_member(it.club_id) THEN
    PERFORM public.community_assert_club_manager(it.club_id);
  END IF;
  DELETE FROM public.community_club_items WHERE id = p_id;
END;
$$;

-- Folders: the leader and admins
CREATE OR REPLACE FUNCTION public.save_community_club_folder(p_club_id UUID, p_id UUID, p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_name TEXT := left(public.community_clean(p_name), 60);
  v_id UUID := p_id;
BEGIN
  PERFORM public.community_assert_club_manager(p_club_id);
  IF v_name IS NULL THEN RAISE EXCEPTION 'Give the folder a name'; END IF;
  IF p_id IS NULL THEN
    IF (SELECT count(*) FROM public.community_club_folders WHERE club_id = p_club_id) >= 50 THEN
      RAISE EXCEPTION 'A workspace can have up to 50 folders';
    END IF;
    INSERT INTO public.community_club_folders (club_id, name, created_by) VALUES (p_club_id, v_name, auth.uid()) RETURNING id INTO v_id;
  ELSE
    UPDATE public.community_club_folders SET name = v_name WHERE id = p_id AND club_id = p_club_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Folder not found'; END IF;
  END IF;
  RETURN v_id;
END;
$$;

-- Deleting a folder keeps its items (they move out of it)
CREATE OR REPLACE FUNCTION public.delete_community_club_folder(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_club UUID;
BEGIN
  SELECT club_id INTO v_club FROM public.community_club_folders WHERE id = p_id;
  IF v_club IS NULL THEN RETURN; END IF;
  PERFORM public.community_assert_club_manager(v_club);
  DELETE FROM public.community_club_folders WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_club_folders(p_club_id UUID)
RETURNS TABLE (id UUID, name TEXT, item_count INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT f.id, f.name, (SELECT count(*) FROM public.community_club_items i WHERE i.folder_id = f.id)::INTEGER
  FROM public.community_club_folders f
  WHERE f.club_id = p_club_id AND (public.community_is_member(p_club_id) OR public.is_admin())
  ORDER BY f.name;
$$;

-- The list (without the geometry, which can be large); community_club_item reads one in full
CREATE OR REPLACE FUNCTION public.community_club_items(p_club_id UUID)
RETURNS TABLE (id UUID, folder_id UUID, kind TEXT, name TEXT, note TEXT, summary JSONB, added_by_name TEXT, is_mine BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.folder_id, i.kind, i.name, i.note,
         jsonb_strip_nulls(jsonb_build_object('distance_m', i.data->'distance_m', 'category', i.data->'category', 'color', i.data->'color', 'token', i.data->'token')),
         public.review_author_name(i.added_by), i.added_by = auth.uid(), i.created_at
  FROM public.community_club_items i
  WHERE i.club_id = p_club_id AND (public.community_is_member(p_club_id) OR public.is_admin())
  ORDER BY i.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.community_club_item(p_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.data FROM public.community_club_items i
  WHERE i.id = p_id AND (public.community_is_member(i.club_id) OR public.is_admin());
$$;

-- 4. Pins and "new posts" ----------------------------------------------------------------------

ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.community_club_reads (
  club_id UUID NOT NULL REFERENCES public.community_clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (club_id, user_id)
);
ALTER TABLE public.community_club_reads ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['community_club_invites', 'community_club_folders', 'community_club_items', 'community_club_reads'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admin reads everything" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Admin reads everything" ON public.%I FOR SELECT TO authenticated USING (public.is_admin())', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- Pin a club post on top of the club feed (up to 3), or unpin it
CREATE OR REPLACE FUNCTION public.pin_community_post(p_post_id UUID, p_pinned BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_club UUID;
BEGIN
  SELECT club_id INTO v_club FROM public.community_posts WHERE id = p_post_id AND status = 'visible';
  IF v_club IS NULL THEN RAISE EXCEPTION 'Only visible club posts can be pinned'; END IF;
  PERFORM public.community_assert_club_manager(v_club);
  IF p_pinned THEN
    IF (SELECT count(*) FROM public.community_posts WHERE club_id = v_club AND pinned_at IS NOT NULL AND id <> p_post_id) >= 3 THEN
      RAISE EXCEPTION 'Up to 3 posts can be pinned. Unpin one first.';
    END IF;
    UPDATE public.community_posts SET pinned_at = COALESCE(pinned_at, now()) WHERE id = p_post_id;
  ELSE
    UPDATE public.community_posts SET pinned_at = NULL WHERE id = p_post_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_community_club_read(p_club_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.community_club_reads (club_id, user_id, read_at)
  SELECT p_club_id, auth.uid(), now() WHERE public.community_is_member(p_club_id)
  ON CONFLICT (club_id, user_id) DO UPDATE SET read_at = now();
$$;

-- Clubs with the caller's role and the posts by others since they last looked
DROP FUNCTION IF EXISTS public.my_community_clubs();
CREATE OR REPLACE FUNCTION public.my_community_clubs()
RETURNS TABLE (
  id UUID, name TEXT, description TEXT, role TEXT, member_count INTEGER, owner_name TEXT, created_at TIMESTAMPTZ,
  region TEXT, contact TEXT, photo_path TEXT, updated_at TIMESTAMPTZ, new_posts INTEGER, can_manage BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.name, c.description, m.role,
         (SELECT count(*) FROM public.community_club_members x WHERE x.club_id = c.id)::INTEGER,
         public.review_author_name(c.owner_id), c.created_at,
         c.region, c.contact, c.photo_path, c.updated_at,
         (SELECT count(*) FROM public.community_posts p
          WHERE p.club_id = c.id AND p.status = 'visible' AND p.author_id <> auth.uid()
            AND p.created_at > COALESCE((SELECT r.read_at FROM public.community_club_reads r WHERE r.club_id = c.id AND r.user_id = auth.uid()), m.created_at))::INTEGER,
         m.role IN ('owner', 'admin') AND (SELECT l.clubs FROM public.community_club_limits(c.owner_id) l) IS DISTINCT FROM 0
  FROM public.community_club_members m
  JOIN public.community_clubs c ON c.id = m.club_id
  WHERE m.user_id = auth.uid()
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, c.name;
$$;

-- Feed: a club's pinned posts come first on its first page (and not again on later pages)
DROP FUNCTION IF EXISTS public.community_feed(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, UUID);
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
  club_id UUID, club_name TEXT, pinned BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.kind, p.title, left(p.body, 280), char_length(p.body) > 280, p.conditions, p.happened_on,
         p.lat, p.lng, p.place_name, p.attachment->>'kind', public.community_post_photos(p.id),
         p.helpful_count, p.comment_count, p.created_at, p.edited_at,
         public.review_author_name(p.author_id), NULLIF(trim(pr.organization), ''),
         COALESCE(p.author_id = auth.uid(), false),
         EXISTS (SELECT 1 FROM public.community_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid()),
         p.club_id, cl.name,
         p_club IS NOT NULL AND p.pinned_at IS NOT NULL
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
    AND NOT (p_club IS NOT NULL AND p_before IS NOT NULL AND p.pinned_at IS NOT NULL)
  ORDER BY (p_club IS NOT NULL AND p.pinned_at IS NOT NULL) DESC, p.pinned_at DESC NULLS LAST, p.created_at DESC
  LIMIT least(greatest(COALESCE(p_limit, 20), 1), 300);
$$;

-- One post, now with its pin and the caller's role in its club (for the pin button)
DROP FUNCTION IF EXISTS public.community_post(UUID);
CREATE OR REPLACE FUNCTION public.community_post(p_id UUID)
RETURNS TABLE (
  id UUID, kind TEXT, title TEXT, body TEXT, conditions TEXT[], happened_on DATE,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION, place_name TEXT, attachment JSONB, photos JSONB,
  helpful_count INTEGER, comment_count INTEGER, created_at TIMESTAMPTZ, edited_at TIMESTAMPTZ, status TEXT,
  author_name TEXT, author_organization TEXT, is_mine BOOLEAN, i_found_helpful BOOLEAN,
  club_id UUID, club_name TEXT, pinned BOOLEAN, my_club_role TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.kind, p.title, p.body, p.conditions, p.happened_on, p.lat, p.lng, p.place_name, p.attachment,
         public.community_post_photos(p.id), p.helpful_count, p.comment_count, p.created_at, p.edited_at, p.status,
         public.review_author_name(p.author_id), NULLIF(trim(pr.organization), ''),
         COALESCE(p.author_id = auth.uid(), false),
         EXISTS (SELECT 1 FROM public.community_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid()),
         p.club_id, cl.name, p.pinned_at IS NOT NULL,
         CASE WHEN p.club_id IS NULL THEN NULL ELSE public.community_club_role(p.club_id) END
  FROM public.community_posts p
  LEFT JOIN public.profiles pr ON pr.id = p.author_id
  LEFT JOIN public.community_clubs cl ON cl.id = p.club_id
  WHERE p.id = p_id
    AND (p.author_id = auth.uid() OR public.is_admin() OR (p.status = 'visible' AND public.community_can_see(p.club_id)));
$$;

-- 5. Who may call what --------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.community_assert_club_manager(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_club_role(UUID) TO anon, authenticated;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'set_community_club_role(UUID, UUID, TEXT)', 'add_community_club_member(UUID, TEXT)', 'remove_community_club_member(UUID, UUID)',
    'community_club_members(UUID)', 'create_community_club_invite(UUID)', 'revoke_community_club_invite(TEXT)',
    'community_club_invites(UUID)', 'join_community_club(TEXT)', 'add_community_club_item(UUID, UUID, JSONB, TEXT)',
    'update_community_club_item(UUID, TEXT, TEXT, UUID)', 'delete_community_club_item(UUID)',
    'save_community_club_folder(UUID, UUID, TEXT)', 'delete_community_club_folder(UUID)', 'community_club_folders(UUID)',
    'community_club_items(UUID)', 'community_club_item(UUID)', 'pin_community_post(UUID, BOOLEAN)',
    'mark_community_club_read(UUID)', 'my_community_clubs()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- Anyone with an invite link sees which club it is (then signs in to join)
REVOKE ALL ON FUNCTION public.community_club_invite_info(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_club_invite_info(TEXT) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.community_feed(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.community_post(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.community_feed(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[], TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.community_post(UUID) TO anon, authenticated;
