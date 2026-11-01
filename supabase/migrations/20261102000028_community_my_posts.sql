-- Community: the "Mine" tab, your own posts newest first, also those hidden by reports or
-- removed by the admin (with their status), public and club posts alike.
-- Requires 20261102000027. Safe to re-run.

CREATE OR REPLACE FUNCTION public.my_community_posts(p_before TIMESTAMPTZ DEFAULT NULL, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID, kind TEXT, title TEXT, body TEXT, truncated BOOLEAN, conditions TEXT[], happened_on DATE,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION, place_name TEXT, attachment_kind TEXT, photos JSONB,
  helpful_count INTEGER, comment_count INTEGER, created_at TIMESTAMPTZ, edited_at TIMESTAMPTZ,
  author_name TEXT, author_organization TEXT, is_mine BOOLEAN, i_found_helpful BOOLEAN,
  club_id UUID, club_name TEXT, pinned BOOLEAN, status TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.kind, p.title, left(p.body, 280), char_length(p.body) > 280, p.conditions, p.happened_on,
         p.lat, p.lng, p.place_name, p.attachment->>'kind', public.community_post_photos(p.id),
         p.helpful_count, p.comment_count, p.created_at, p.edited_at,
         public.review_author_name(p.author_id), NULLIF(trim(pr.organization), ''),
         true,
         EXISTS (SELECT 1 FROM public.community_reactions r WHERE r.post_id = p.id AND r.user_id = auth.uid()),
         p.club_id, cl.name, p.pinned_at IS NOT NULL, p.status
  FROM public.community_posts p
  LEFT JOIN public.profiles pr ON pr.id = p.author_id
  LEFT JOIN public.community_clubs cl ON cl.id = p.club_id
  WHERE p.author_id = auth.uid() AND auth.uid() IS NOT NULL
    AND (p_before IS NULL OR p.created_at < p_before)
  ORDER BY p.created_at DESC
  LIMIT least(greatest(COALESCE(p_limit, 20), 1), 100);
$$;

REVOKE ALL ON FUNCTION public.my_community_posts(TIMESTAMPTZ, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_community_posts(TIMESTAMPTZ, INTEGER) TO authenticated;
