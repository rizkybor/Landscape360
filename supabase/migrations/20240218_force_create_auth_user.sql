-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Force insert user into auth.users if not exists
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) 
SELECT 
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'monitoring@landscape360.app',
  crypt('password123', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'monitoring@landscape360.app'
);

-- Update the profile to ensure it has Enterprise and monitor360 role
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'monitoring@landscape360.app';
  
  IF v_user_id IS NOT NULL THEN
    -- Upsert profile
    INSERT INTO public.profiles (id, email, status_subscribe, status_user)
    VALUES (v_user_id, 'monitoring@landscape360.app', 'Enterprise', 'monitor360')
    ON CONFLICT (id) DO UPDATE
    SET 
      status_subscribe = 'Enterprise',
      status_user = 'monitor360';
  END IF;
END $$;
