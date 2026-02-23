
-- Update monitoring@landscape360.app profile to ensure it has monitor360 status
-- This requires accessing auth.users which is restricted, so we use security definer function or run as superuser (migrations run as postgres).

DO $$
BEGIN
    UPDATE public.profiles
    SET status_user = 'monitor360', status_subscribe = 'Enterprise'
    FROM auth.users
    WHERE public.profiles.id = auth.users.id
    AND auth.users.email = 'monitoring@landscape360.app';
END $$;
