-- Fix Infinite Recursion in Profiles Policy
-- The recursion happens because "Monitors can view all profiles" policy
-- queries the "profiles" table itself to check if the user is a monitor.

-- Reset policies for profiles
DROP POLICY IF EXISTS "Users can read own profile" ON "public"."profiles";
DROP POLICY IF EXISTS "Monitors can read all profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Users can view own profile" ON "public"."profiles";
DROP POLICY IF EXISTS "Monitors can view all profiles" ON "public"."profiles";

-- Enable RLS
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

-- 1. Users can view their own profile (Simple, no recursion)
CREATE POLICY "Users can view own profile"
ON "public"."profiles"
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Monitors can view ALL profiles (FIXED)
-- Instead of querying the table recursively inside the policy,
-- we rely on a secure function or use auth.jwt() metadata if available.
-- However, since we store roles in the table, we must avoid self-referencing loop.

-- Solution: Use a SECURITY DEFINER function to bypass RLS for the role check
CREATE OR REPLACE FUNCTION public.is_monitor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND status_user = 'monitor360'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now use the function in the policy
CREATE POLICY "Monitors can view all profiles"
ON "public"."profiles"
FOR SELECT
TO authenticated
USING (public.is_monitor());

-- Also fix tracker_logs to use the function for better performance/safety
DROP POLICY IF EXISTS "Monitors can view all logs" ON "public"."tracker_logs";

CREATE POLICY "Monitors can view all logs"
ON "public"."tracker_logs"
FOR SELECT
TO authenticated
USING (public.is_monitor());
