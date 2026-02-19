-- Create Tracker Logs Table
CREATE TABLE IF NOT EXISTS public.tracker_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    elevation DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    battery INTEGER,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tracker_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own logs
CREATE POLICY "Users can insert their own logs" 
ON public.tracker_logs 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own logs
CREATE POLICY "Users can view their own logs" 
ON public.tracker_logs 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Policy: Enterprise Monitors can view all logs
CREATE POLICY "Monitors can view all logs" 
ON public.tracker_logs 
FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.status_subscribe = 'Enterprise'
    AND profiles.status_user = 'monitor360'
  )
);

-- Create Index for Performance
CREATE INDEX IF NOT EXISTS idx_tracker_logs_user_timestamp 
ON public.tracker_logs (user_id, timestamp DESC);

-- Create Index for Spatial Queries (Optional but recommended)
-- CREATE INDEX IF NOT EXISTS idx_tracker_logs_lat_lng ON public.tracker_logs (lat, lng);
