-- Add status_user column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status_user text DEFAULT 'pengguna360';

-- Update specific users as requested
UPDATE public.profiles 
SET status_user = 'monitor360' 
WHERE email = 'demo@landscape360.app';

UPDATE public.profiles 
SET status_user = 'pengguna360' 
WHERE email = 'rizkyak994@gmail.com';
