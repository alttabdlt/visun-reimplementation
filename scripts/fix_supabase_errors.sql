-- Fix all Supabase errors in one script

-- 1. Fix chat_sessions RLS policy
ALTER TABLE IF EXISTS public.chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all operations for now" ON public.chat_sessions;
CREATE POLICY "Allow all operations for now" 
ON public.chat_sessions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 2. Fix user_settings policy
DROP POLICY IF EXISTS "Users can read their own settings" ON user_settings;
CREATE POLICY "Users can read their own settings" 
ON user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

-- 3. Create logs table that was missing
CREATE TABLE IF NOT EXISTS public.logs (
  id SERIAL PRIMARY KEY,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on logs" 
ON public.logs 
FOR ALL 
USING (true) 
WITH CHECK (true);
GRANT ALL ON public.logs TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.logs_id_seq TO anon, authenticated, service_role;

-- 4. Fix storage buckets duplicate key error
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'animations') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('animations', 'animations', true);
  END IF;
END
$$;
