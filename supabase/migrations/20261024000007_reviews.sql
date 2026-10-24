-- Public reviews: anyone (signed in or not) can read them, any signed-in account can write
-- one review (and edit or delete it), and only the admin can reply to or hide a review.
-- The table is never accessed directly from the browser: every read and write goes through
-- the functions below, which also keep reviewers' email addresses private. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL CHECK (char_length(trim(comment)) BETWEEN 10 AND 2000),
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  admin_reply TEXT CHECK (char_length(admin_reply) <= 2000),
  admin_reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_visible_created_idx
  ON public.reviews (created_at DESC) WHERE NOT is_hidden;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reviews FROM anon, authenticated;

-- Same definition as in 20261024000003 so this migration also works on its own
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin);
$$;

-- "Rizky A." from the account's display name; never the email address
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
          u.raw_user_meta_data->>'full_name',
          u.raw_user_meta_data->>'display_name',
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

-- Reading -------------------------------------------------------------------------------

-- Visible reviews, newest first (the admin also sees hidden ones). p_rating filters by stars.
CREATE OR REPLACE FUNCTION public.list_reviews(
  p_rating SMALLINT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  rating SMALLINT,
  comment TEXT,
  author_name TEXT,
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
         COALESCE(r.user_id = auth.uid(), false), r.is_hidden, r.admin_reply, r.admin_reply_at,
         r.created_at, r.updated_at
  FROM public.reviews r
  WHERE (NOT r.is_hidden OR public.is_admin())
    AND (p_rating IS NULL OR r.rating = p_rating)
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
  OFFSET GREATEST(p_offset, 0);
$$;

CREATE OR REPLACE FUNCTION public.review_summary()
RETURNS TABLE (
  total BIGINT,
  average NUMERIC,
  stars_1 BIGINT,
  stars_2 BIGINT,
  stars_3 BIGINT,
  stars_4 BIGINT,
  stars_5 BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*),
         COALESCE(round(AVG(rating)::numeric, 1), 0),
         COUNT(*) FILTER (WHERE rating = 1),
         COUNT(*) FILTER (WHERE rating = 2),
         COUNT(*) FILTER (WHERE rating = 3),
         COUNT(*) FILTER (WHERE rating = 4),
         COUNT(*) FILTER (WHERE rating = 5)
  FROM public.reviews
  WHERE NOT is_hidden;
$$;

-- The signed-in account's own review (also when hidden), or no row
CREATE OR REPLACE FUNCTION public.my_review()
RETURNS TABLE (
  id UUID,
  rating SMALLINT,
  comment TEXT,
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
  SELECT r.id, r.rating, r.comment, r.is_hidden, r.admin_reply, r.admin_reply_at, r.created_at, r.updated_at
  FROM public.reviews r
  WHERE r.user_id = auth.uid();
$$;

-- Writing (any signed-in account, own review only) --------------------------------------

CREATE OR REPLACE FUNCTION public.submit_review(p_rating SMALLINT, p_comment TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to write a review';
  END IF;
  IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Choose a rating from 1 to 5 stars';
  END IF;
  IF p_comment IS NULL OR char_length(trim(p_comment)) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Your review must be between 10 and 2000 characters';
  END IF;

  INSERT INTO public.reviews (user_id, rating, comment)
  VALUES (auth.uid(), p_rating, trim(p_comment))
  ON CONFLICT (user_id) DO UPDATE
    SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_my_review()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.reviews WHERE user_id = auth.uid();
$$;

-- Admin only ----------------------------------------------------------------------------

-- Reply to a review; an empty reply removes it
CREATE OR REPLACE FUNCTION public.admin_reply_review(p_review_id UUID, p_reply TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the admin can reply to reviews';
  END IF;
  IF p_reply IS NOT NULL AND char_length(trim(p_reply)) > 2000 THEN
    RAISE EXCEPTION 'The reply must be at most 2000 characters';
  END IF;

  UPDATE public.reviews
  SET admin_reply = NULLIF(trim(p_reply), ''),
      admin_reply_at = CASE WHEN NULLIF(trim(p_reply), '') IS NULL THEN NULL ELSE now() END
  WHERE id = p_review_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found';
  END IF;
END;
$$;

-- Hide spam or abusive reviews from the public list (the author still sees their own)
CREATE OR REPLACE FUNCTION public.admin_set_review_hidden(p_review_id UUID, p_hidden BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the admin can hide reviews';
  END IF;

  UPDATE public.reviews SET is_hidden = COALESCE(p_hidden, false) WHERE id = p_review_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.list_reviews(SMALLINT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_review() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_review(SMALLINT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_my_review() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reply_review(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_review_hidden(UUID, BOOLEAN) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_reviews(SMALLINT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_summary() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_review() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(SMALLINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_review() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reply_review(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_review_hidden(UUID, BOOLEAN) TO authenticated;
