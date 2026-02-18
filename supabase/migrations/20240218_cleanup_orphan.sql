-- Delete the orphan profile to avoid conflicts when you create the real user
DELETE FROM public.profiles WHERE email = 'monitoring@landscape360.app';
