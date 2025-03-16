-- Create chat_messages table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.chat_sessions(session_id) ON DELETE CASCADE,
  user_query TEXT NOT NULL,
  ai_response JSONB NOT NULL,
  animation_status TEXT,
  animation_url JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Add RLS policies
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop policy if it exists and create it again
DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Allow all operations for now" ON public.chat_messages;
  EXCEPTION WHEN OTHERS THEN
    -- Do nothing, policy doesn't exist
  END;
  
  CREATE POLICY "Allow all operations for now" 
  ON public.chat_messages 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
END
$$;

-- Grant access to the anon role
GRANT ALL ON public.chat_messages TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.chat_messages_id_seq TO anon;

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_chat_messages_updated_at'
  ) THEN
    CREATE TRIGGER update_chat_messages_updated_at
    BEFORE UPDATE ON public.chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;
