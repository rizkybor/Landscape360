-- 1. Change demo@landscape360.app back to 'pengguna360'
UPDATE public.profiles 
SET status_user = 'pengguna360' 
WHERE email = 'demo@landscape360.app';

-- 2. Create new user 'monitoring@landscape360.app' (Needs to exist in auth.users first, but we can't insert there directly easily via SQL in migration usually)
-- However, if the user already exists or we assume they will sign up, we can prep the profile.
-- Since we can't create auth users via simple SQL migration easily (needs admin API or specific auth schema access),
-- I will create a trigger/function or just update if exists. 
-- BUT, for this task, I will assume the user needs to be inserted into profiles manually or via a script if they don't exist.
-- Let's try to insert into profiles directly if we can't create auth user.
-- ACTUALLY, usually profiles are created via trigger on auth.users insert.
-- So I should just update the profile IF it exists. 
-- Wait, I can't create a loginable user via SQL migration easily without knowing the password hash.

-- STRATEGY: I will just provide the SQL to update the profile assuming the user will be created or already exists.
-- But the user asked to "add 1 account". I can't generate a valid Supabase auth user with password via simple SQL migration file usually.
-- I will proceed by:
-- 1. Updating demo@...
-- 2. Attempting to insert a placeholder profile for monitoring@... (though they won't be able to login without an auth.users entry).

-- CORRECT APPROACH:
-- I will update the existing demo user.
-- For the new user, since I cannot create a fully functional Supabase Auth user (with password) via just a migration file (requires hashing etc), 
-- I will ask the user to Sign Up first, OR I will try to use the `auth.users` table if I have permissions (often restricted).

-- Let's try to update the demo user first.
UPDATE public.profiles 
SET status_user = 'pengguna360' 
WHERE email = 'demo@landscape360.app';

-- Check if monitoring@landscape360.app exists in profiles and update it, 
-- or insert a dummy one (which won't work for login).
-- Instead, I'll provide a script to run via Supabase dashboard or I'll just say "Please sign up with monitoring@landscape360.app first".
-- OR, I can use a script to create the user via Supabase Admin API if available in the environment?
-- No, I only have SQL tool.

-- Let's try to INSERT into auth.users (if permissions allow, usually postgres role can).
-- This is risky/complex. 
-- BETTER: I will just update the profile for 'monitoring@landscape360.app' ON CONFLICT.
-- The user likely needs to sign up manually.

-- WAIT, I can use the existing 'demo' user as 'pengguna360' as requested.
-- And I will try to Insert a fake/test user into auth.users if possible, but standard way is:
-- User signs up -> Trigger creates profile -> We update profile.

-- Let's just create the SQL to update them.
-- I will assume the user 'monitoring@landscape360.app' will be created by the user or already exists.
-- IF you want me to FORCE create it, I can try inserting into auth.users with a dummy hash.

-- Let's just do the update for demo and prepared update for monitoring.
