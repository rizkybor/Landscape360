-- 1. Users could update their own profile row without column restrictions, which let
--    anyone change their own status_subscribe (plan), status_user (role) or admin flag
--    from the browser. The app never writes profiles from the client; plan and role
--    changes now go through /api/admin-users using the service role, which bypasses RLS.
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 2. Admin flag for user & plan management, independent of plan and role
--    (several accounts may be monitor360; only flagged accounts are admins).
--    Admins have full access, so their status_subscribe / status_user are ignored.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Only one admin account may exist: at most one row can have is_admin = true.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_single_admin
  ON public.profiles ((is_admin))
  WHERE is_admin;

-- 3. Admins pass every monitor check (tracker logs, activity sessions, profiles).
CREATE OR REPLACE FUNCTION public.is_monitor()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (
        is_admin
        OR (status_user = 'monitor360' AND status_subscribe = 'Enterprise')
      )
  );
END;
$$;

-- 4. Admins get the highest offline map limits.
CREATE OR REPLACE FUNCTION public.check_offline_map_limits()
RETURNS TRIGGER AS $$
DECLARE
    user_tier text;
    user_is_admin boolean;
    current_count integer;
    max_count integer;
    max_size_mb double precision;
BEGIN
    SELECT status_subscribe, is_admin INTO user_tier, user_is_admin
    FROM public.profiles
    WHERE id = NEW.user_id;

    IF user_is_admin THEN
        user_tier := 'Enterprise';
    ELSIF user_tier IS NULL THEN
        user_tier := 'Free';
    END IF;

    IF user_tier = 'Enterprise' THEN
        max_count := 10;
        max_size_mb := 25.0;
    ELSIF user_tier = 'Pro' THEN
        max_count := 3;
        max_size_mb := 10.0;
    ELSE -- Free
        max_count := 1;
        max_size_mb := 1.0;
    END IF;

    IF NEW.size_est_mb > max_size_mb THEN
        RAISE EXCEPTION 'Map size (%) exceeds the limit of % MB for % plan.', NEW.size_est_mb, max_size_mb, user_tier;
    END IF;

    SELECT COUNT(*) INTO current_count
    FROM public.offline_maps
    WHERE user_id = NEW.user_id;

    IF current_count >= max_count THEN
        RAISE EXCEPTION 'You have reached the maximum number of offline maps (%) for % plan.', max_count, user_tier;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant admin access to an account (or use: node scripts/create_user.js <email> <password> "" "" Admin).
-- Fails if another admin already exists; to move admin access, unset the old one first:
--   UPDATE public.profiles SET is_admin = false WHERE is_admin;
--   UPDATE public.profiles SET is_admin = true WHERE email = '<admin email>';
