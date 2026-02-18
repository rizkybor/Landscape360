-- Update the CHECK constraint for status_subscribe to include 'Enterprise'
-- The current constraint is likely: status_subscribe = ANY (ARRAY['Free'::text, 'Pro'::text, 'Ultimate'::text])
-- We need to change it to include 'Enterprise'

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_subscribe_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_subscribe_check 
CHECK (status_subscribe = ANY (ARRAY['Free'::text, 'Pro'::text, 'Enterprise'::text]));

-- Now proceed with user creation/update
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Check if user exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'monitoring@landscape360.app';
  
  -- If not, create
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      'authenticated',
      'authenticated',
      'monitoring@landscape360.app',
      crypt('password123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      now(),
      now()
    );
  END IF;

  -- Now ensure profile is correct
  INSERT INTO public.profiles (id, email, status_subscribe, status_user)
  VALUES (v_user_id, 'monitoring@landscape360.app', 'Enterprise', 'monitor360')
  ON CONFLICT (id) DO UPDATE
  SET 
    status_subscribe = 'Enterprise',
    status_user = 'monitor360';
    
END $$;
