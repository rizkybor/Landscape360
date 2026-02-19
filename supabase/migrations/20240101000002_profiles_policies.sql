-- Allow users to read their own profile
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow Monitors to read ALL profiles
CREATE POLICY "Monitors can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles as p
    WHERE p.id = auth.uid()
    AND p.status_subscribe = 'Enterprise'
    AND p.status_user = 'monitor360'
  )
);
