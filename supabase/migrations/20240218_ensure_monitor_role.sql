-- Ensure updates for monitoring@landscape360.app are applied correctly
UPDATE public.profiles 
SET 
  status_subscribe = 'Enterprise',
  status_user = 'monitor360'
WHERE email = 'monitoring@landscape360.app';
