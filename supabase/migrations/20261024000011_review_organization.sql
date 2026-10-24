-- Reviews show the reviewer's organization (when set) next to their name. Requires
-- 20261024000009_profile_contact.sql (profiles.organization). Also reads the name from
-- display_name first, the account's one name field, like the rest of the app.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.review_author_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN array_length(parts, 1) > 1 THEN parts[1] || ' ' || upper(left(parts[array_length(parts, 1)], 1)) || '.'
        ELSE parts[1]
      END
      FROM (
        SELECT regexp_split_to_array(trim(COALESCE(
          NULLIF(u.raw_user_meta_data->>'display_name', ''),
          NULLIF(u.raw_user_meta_data->>'full_name', ''),
          u.raw_user_meta_data->>'name'
        )), '\s+') AS parts
        FROM auth.users u
        WHERE u.id = p_user_id
      ) n
      WHERE parts[1] <> ''
    ),
    'Landscape 360 user'
  );
$$;

REVOKE ALL ON FUNCTION public.review_author_name(UUID) FROM PUBLIC, anon, authenticated;

-- The returned columns change, which CREATE OR REPLACE cannot do
DROP FUNCTION IF EXISTS public.list_reviews(SMALLINT, INTEGER, INTEGER);

CREATE FUNCTION public.list_reviews(
  p_rating SMALLINT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  rating SMALLINT,
  comment TEXT,
  author_name TEXT,
  author_organization TEXT,
  is_mine BOOLEAN,
  is_hidden BOOLEAN,
  admin_reply TEXT,
  admin_reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.rating, r.comment, public.review_author_name(r.user_id),
         NULLIF(trim(p.organization), ''),
         COALESCE(r.user_id = auth.uid(), false), r.is_hidden, r.admin_reply, r.admin_reply_at,
         r.created_at, r.updated_at
  FROM public.reviews r
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE (NOT r.is_hidden OR public.is_admin())
    AND (p_rating IS NULL OR r.rating = p_rating)
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
  OFFSET GREATEST(p_offset, 0);
$$;

REVOKE ALL ON FUNCTION public.list_reviews(SMALLINT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_reviews(SMALLINT, INTEGER, INTEGER) TO anon, authenticated;
