-- Create a new user in auth.users
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'monitoring@landscape360.app',
  crypt('password123', gen_salt('bf')), -- Default password: password123
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
) ON CONFLICT (email) DO NOTHING;

-- Now update the profile (trigger should have created it, but we can upsert or update)
-- We need to find the ID we just inserted or existing ID
DO $$
DECLARE
  new_user_id uuid;
BEGIN
  SELECT id INTO new_user_id FROM auth.users WHERE email = 'monitoring@landscape360.app';
  
  -- Update profile if exists (Trigger usually creates it)
  UPDATE public.profiles
  SET 
    status_subscribe = 'Enterprise',
    status_user = 'monitor360'
  WHERE id = new_user_id;
  
  -- If trigger didn't fire (sometimes happens in direct SQL inserts depending on setup), insert manually
  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, email, status_subscribe, status_user)
    VALUES (new_user_id, 'monitoring@landscape360.app', 'Enterprise', 'monitor360')
    ON CONFLICT (id) DO UPDATE
    SET status_subscribe = 'Enterprise', status_user = 'monitor360';
  END IF;
END $$;
