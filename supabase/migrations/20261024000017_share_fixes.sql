-- Sharing fixes. Safe to re-run.
--
-- 1. "column reference "shared_with" is ambiguous" when sharing a marked location or a
--    recorded track: the functions return a column called shared_with, which clashed with
--    the table column in ON CONFLICT (..., shared_with). They now name the constraint.
-- 2. Easier sharing: share_marked_locations() also accepts the recipient's account id
--    (picked from suggestions), and marked_location_share_suggestions() lists people to
--    share with: recent recipients, or accounts matching a name or email as you type.

CREATE OR REPLACE FUNCTION public.share_marked_locations(p_location_ids UUID[], p_recipient TEXT)
RETURNS TABLE (shared_with UUID, name TEXT, email_masked TEXT, shared_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
DECLARE
  v_query TEXT := lower(trim(p_recipient));
  v_matches UUID[];
  v_recipient UUID;
  v_count INTEGER;
BEGIN
  IF NOT public.can_share_marked_locations() THEN
    RAISE EXCEPTION 'Your plan does not allow sharing locations';
  END IF;
  IF p_location_ids IS NULL OR cardinality(p_location_ids) = 0 THEN
    RAISE EXCEPTION 'Select at least one location to share';
  END IF;
  IF cardinality(p_location_ids) > 500 THEN
    RAISE EXCEPTION 'You can share at most 500 locations at once';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_location_ids) AS l(id)
    WHERE NOT public.is_marked_location_owner(l.id)
  ) THEN
    RAISE EXCEPTION 'You can only share your own locations';
  END IF;
  IF v_query IS NULL OR v_query = '' THEN
    RAISE EXCEPTION 'Enter the recipient''s email or name';
  END IF;

  IF v_query ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    -- Picked from the suggestions
    SELECT array_agg(p.id) INTO v_matches FROM public.profiles p WHERE p.id = v_query::UUID;
  ELSIF position('@' IN v_query) > 0 THEN
    SELECT array_agg(p.id) INTO v_matches FROM public.profiles p WHERE lower(p.email) = v_query;
  ELSE
    SELECT array_agg(u.id) INTO v_matches
    FROM auth.users u
    WHERE lower(trim(u.raw_user_meta_data->>'full_name')) = v_query
       OR lower(trim(u.raw_user_meta_data->>'display_name')) = v_query
       OR lower(trim(u.raw_user_meta_data->>'name')) = v_query;
  END IF;

  IF v_matches IS NULL OR cardinality(v_matches) = 0 THEN
    RAISE EXCEPTION 'No Landscape360 account found for "%"', trim(p_recipient);
  END IF;
  IF cardinality(v_matches) > 1 THEN
    RAISE EXCEPTION 'Several accounts use the name "%". Pick one from the list or use their email.', trim(p_recipient);
  END IF;

  v_recipient := v_matches[1];
  IF v_recipient = auth.uid() THEN
    RAISE EXCEPTION 'You cannot share with yourself';
  END IF;

  INSERT INTO public.marked_location_shares (location_id, owner_id, shared_with)
  SELECT DISTINCT l.id, auth.uid(), v_recipient FROM unnest(p_location_ids) AS l(id)
  ON CONFLICT ON CONSTRAINT marked_location_shares_pkey DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY
  SELECT v_recipient,
         public.account_display_name(v_recipient),
         public.mask_email(p.email),
         v_count
  FROM public.profiles p
  WHERE p.id = v_recipient;
END;
$$;

-- People to share with. Empty query: the accounts I shared with most recently. Otherwise
-- accounts whose name contains, or whose email starts with, the text (at least 2 letters).
-- Only names and masked emails are returned.
CREATE OR REPLACE FUNCTION public.marked_location_share_suggestions(p_query TEXT DEFAULT '')
RETURNS TABLE (user_id UUID, name TEXT, email_masked TEXT, recent BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
#variable_conflict use_column
DECLARE
  v_query TEXT := lower(trim(COALESCE(p_query, '')));
BEGIN
  IF NOT public.can_share_marked_locations() THEN
    RETURN;
  END IF;

  IF char_length(v_query) < 2 THEN
    RETURN QUERY
    SELECT r.shared_with, public.account_display_name(r.shared_with), public.mask_email(p.email), true
    FROM (
      SELECT s.shared_with, max(s.created_at) AS last_at
      FROM public.marked_location_shares s
      WHERE s.owner_id = auth.uid()
      GROUP BY s.shared_with
    ) r
    JOIN public.profiles p ON p.id = r.shared_with
    ORDER BY r.last_at DESC
    LIMIT 6;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id,
         public.account_display_name(u.id),
         public.mask_email(p.email),
         EXISTS (SELECT 1 FROM public.marked_location_shares s WHERE s.owner_id = auth.uid() AND s.shared_with = u.id)
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE u.id <> auth.uid()
    AND (
      position(v_query IN lower(p.email)) = 1
      OR position(v_query IN lower(COALESCE(public.account_display_name(u.id), ''))) > 0
    )
  ORDER BY 4 DESC, 2 NULLS LAST
  LIMIT 6;
END;
$$;

CREATE OR REPLACE FUNCTION public.share_recorded_track(p_track_id UUID, p_email TEXT)
RETURNS TABLE (shared_with UUID, email TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
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
  ON CONFLICT ON CONSTRAINT recorded_track_shares_pkey DO NOTHING;

  RETURN QUERY
  SELECT s.shared_with, v_email, s.created_at
  FROM public.recorded_track_shares s
  WHERE s.track_id = p_track_id AND s.shared_with = v_recipient;
END;
$$;

REVOKE ALL ON FUNCTION public.marked_location_share_suggestions(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marked_location_share_suggestions(TEXT) TO authenticated;
