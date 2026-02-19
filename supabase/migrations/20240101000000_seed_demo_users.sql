
DO $$
DECLARE
  i INT;
  new_user_id UUID;
  email_text TEXT;
BEGIN
  -- 1. Create Enterprise Monitor User
  email_text := 'monitor@enterprise.com';
  
  -- Check if user exists
  SELECT id INTO new_user_id FROM auth.users WHERE email = email_text;
  
  IF new_user_id IS NULL THEN
    new_user_id := gen_random_uuid();
    
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
      new_user_id,
      'authenticated',
      'authenticated',
      email_text,
      crypt('password123', gen_salt('bf')),
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
    );
  END IF;

  -- Insert/Update Profile for Enterprise Monitor
  INSERT INTO public.profiles (id, email, status_subscribe, status_user)
  VALUES (new_user_id, email_text, 'Enterprise', 'monitor360')
  ON CONFLICT (id) DO UPDATE 
  SET status_subscribe = 'Enterprise', status_user = 'monitor360';

  -- 2. Create Pro Users (10 users)
  FOR i IN 1..10 LOOP
    email_text := 'pro_user_' || i || '@example.com';
    
    -- Check if user exists
    SELECT id INTO new_user_id FROM auth.users WHERE email = email_text;
    
    IF new_user_id IS NULL THEN
      new_user_id := gen_random_uuid();
      
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
        new_user_id,
        'authenticated',
        'authenticated',
        email_text,
        crypt('password123', gen_salt('bf')),
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
      );
    END IF;

    -- Insert/Update Profile for Pro User
    INSERT INTO public.profiles (id, email, status_subscribe, status_user)
    VALUES (new_user_id, email_text, 'Pro', 'pengguna360')
    ON CONFLICT (id) DO UPDATE
    SET status_subscribe = 'Pro', status_user = 'pengguna360';
    
  END LOOP;
END $$;

