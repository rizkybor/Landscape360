
-- Function to get grouped session summaries
-- This replaces client-side aggregation for better performance
-- It groups logs by User + Date (UTC based for simplicity, can be adjusted)

CREATE OR REPLACE FUNCTION get_tracker_sessions(
  p_user_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  session_date DATE,
  user_id UUID,
  point_count BIGINT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If p_user_id is provided, filter by it.
  -- If p_user_id is NULL, check if caller is monitor.
  -- If caller is NOT monitor and p_user_id is NULL, force filter to auth.uid()
  
  IF p_user_id IS NULL AND NOT public.is_monitor() THEN
      p_user_id := auth.uid();
  END IF;

  RETURN QUERY
  SELECT
    (t.timestamp AT TIME ZONE 'UTC')::date as session_date,
    t.user_id,
    COUNT(*) as point_count,
    MIN(t.timestamp) as start_time,
    MAX(t.timestamp) as end_time
  FROM tracker_logs t
  WHERE (p_user_id IS NULL OR t.user_id = p_user_id)
  -- For non-monitors trying to access other's data (if they pass a p_user_id),
  -- RLS on tracker_logs would normally handle it, but since this is SECURITY DEFINER,
  -- we must enforce it manually or rely on the WHERE clause above + logic.
  -- To be safe, let's enforce: if not monitor, must be own data.
  AND (
      public.is_monitor() 
      OR 
      t.user_id = auth.uid()
  )
  GROUP BY session_date, t.user_id
  ORDER BY session_date DESC, start_time DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
