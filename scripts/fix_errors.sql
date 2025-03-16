-- Fix SQL syntax error with policy
-- First check if RLS is already enabled, if not enable it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'chat_sessions'
    AND n.nspname = 'public'
    AND c.relrowsecurity = true
  ) THEN
    ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;

-- Drop policy if it exists and create it again
DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Allow all operations for now" ON public.chat_sessions;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  CREATE POLICY "Allow all operations for now" 
  ON public.chat_sessions 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
END
$$;

-- Fix duplicate policy error for user_settings
DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Users can read their own settings" ON user_settings;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist or can't be dropped
  END;
  
  BEGIN
    CREATE POLICY "Users can read their own settings" 
      ON user_settings 
      FOR SELECT 
      USING (auth.uid() = user_id);
  EXCEPTION WHEN OTHERS THEN
    -- Policy might already exist
  END;
END
$$;

-- Fix storage buckets duplicate key error
-- First check if the bucket exists before trying to create it
DO $$
BEGIN
  -- Create animations bucket if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'animations'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('animations', 'animations', true);
  END IF;
END
$$;

-- Fix missing logs table error
-- This is likely from an application trying to access a logs table that doesn't exist
-- Create a simple logs table if needed by your application
CREATE TABLE IF NOT EXISTS public.logs (
  id SERIAL PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS to logs table
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- Create policy for logs
DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Allow all operations on logs" ON public.logs;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  CREATE POLICY "Allow all operations on logs" 
  ON public.logs 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
END
$$;

-- Grant access to the logs table
GRANT ALL ON public.logs TO anon;
GRANT ALL ON public.logs TO authenticated;
GRANT ALL ON public.logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.logs_id_seq TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.logs_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.logs_id_seq TO service_role;
