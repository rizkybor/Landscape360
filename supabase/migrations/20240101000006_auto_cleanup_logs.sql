-- Enable pg_cron extension (Required for scheduled jobs)
-- Note: You might need to enable this in Supabase Dashboard > Database > Extensions first!
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to delete old logs
CREATE OR REPLACE FUNCTION delete_old_tracker_logs()
RETURNS void AS $$
BEGIN
  -- Delete logs older than 7 days based on their timestamp
  DELETE FROM public.tracker_logs
  WHERE timestamp < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule the job to run daily at 3:00 AM UTC
-- This ensures that logs are cleaned up regularly without manual intervention
SELECT cron.schedule(
  'cleanup-tracker-logs', -- Job name
  '0 3 * * *',            -- Cron schedule (At 03:00)
  $$SELECT delete_old_tracker_logs()$$
);
