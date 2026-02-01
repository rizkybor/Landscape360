-- Update the subscription status for the demo account to 'Free'
UPDATE public.profiles
SET status_subscribe = 'Free'
WHERE email = 'demo@landscape360.app';
