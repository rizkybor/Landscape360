-- Reset policies for tracker_logs
DROP POLICY IF EXISTS "Enable insert for users based on user_id" ON "public"."tracker_logs";
DROP POLICY IF EXISTS "Enable select for users based on user_id" ON "public"."tracker_logs";
DROP POLICY IF EXISTS "Enable select for monitors" ON "public"."tracker_logs";
DROP POLICY IF EXISTS "Users can insert own logs" ON "public"."tracker_logs";
DROP POLICY IF EXISTS "Users can view own logs" ON "public"."tracker_logs";
DROP POLICY IF EXISTS "Monitors can view all logs" ON "public"."tracker_logs";

-- Reset policies for profiles
DROP POLICY IF EXISTS "Users can read own profile" ON "public"."profiles";
DROP POLICY IF EXISTS "Monitors can read all profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Users can view own profile" ON "public"."profiles";
DROP POLICY IF EXISTS "Monitors can view all profiles" ON "public"."profiles";

-- Enable RLS
ALTER TABLE "public"."tracker_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

-- Policies for tracker_logs

-- 1. Users can insert their own logs
CREATE POLICY "Users can insert own logs"
ON "public"."tracker_logs"
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. Users can view their own logs
CREATE POLICY "Users can view own logs"
ON "public"."tracker_logs"
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Monitors can view ALL logs
CREATE POLICY "Monitors can view all logs"
ON "public"."tracker_logs"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND status_user = 'monitor360'
  )
);

-- Policies for profiles

-- 1. Users can view their own profile
CREATE POLICY "Users can view own profile"
ON "public"."profiles"
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Monitors can view ALL profiles
CREATE POLICY "Monitors can view all profiles"
ON "public"."profiles"
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND status_user = 'monitor360'
  )
);
