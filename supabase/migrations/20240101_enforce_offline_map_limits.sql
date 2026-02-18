-- Create a function to check limits before inserting a new offline map
CREATE OR REPLACE FUNCTION public.check_offline_map_limits()
RETURNS TRIGGER AS $$
DECLARE
    user_tier text;
    current_count integer;
    current_size_mb double precision;
    max_count integer;
    max_size_mb double precision;
BEGIN
    -- 1. Get the user's subscription status
    SELECT status_subscribe INTO user_tier
    FROM public.profiles
    WHERE id = NEW.user_id;

    -- Default to 'Free' if not found
    IF user_tier IS NULL THEN
        user_tier := 'Free';
    END IF;

    -- 2. Define Limits based on Tier
    IF user_tier = 'Enterprise' THEN
        max_count := 10;
        max_size_mb := 25.0;
    ELSIF user_tier = 'Pro' THEN
        max_count := 3;
        max_size_mb := 10.0;
    ELSE -- Free
        max_count := 1;
        max_size_mb := 1.0;
    END IF;

    -- 3. Check Individual Map Size Limit (for the new map being inserted)
    IF NEW.size_est_mb > max_size_mb THEN
        RAISE EXCEPTION 'Map size (%) exceeds the limit of % MB for % plan.', NEW.size_est_mb, max_size_mb, user_tier;
    END IF;

    -- 4. Get Current Usage (Count)
    SELECT COUNT(*) INTO current_count
    FROM public.offline_maps
    WHERE user_id = NEW.user_id;

    -- 5. Check Count Limit
    -- Note: We use >= because we are running BEFORE INSERT, so the new row isn't counted yet.
    IF current_count >= max_count THEN
        RAISE EXCEPTION 'You have reached the maximum number of offline maps (%) for % plan.', max_count, user_tier;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS enforce_offline_map_limits_trigger ON public.offline_maps;

CREATE TRIGGER enforce_offline_map_limits_trigger
BEFORE INSERT ON public.offline_maps
FOR EACH ROW
EXECUTE FUNCTION public.check_offline_map_limits();
