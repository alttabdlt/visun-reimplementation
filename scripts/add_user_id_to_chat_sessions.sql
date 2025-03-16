-- Add user_id column to chat_sessions table
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON public.chat_sessions(user_id);

-- Temporarily disable RLS to allow migration
ALTER TABLE public.chat_sessions DISABLE ROW LEVEL SECURITY;

-- Update RLS policies to restrict access by user_id
DROP POLICY IF EXISTS "Allow all operations for now" ON public.chat_sessions;

-- Create policies for user-specific access
CREATE POLICY "Users can view their own chat sessions"
ON public.chat_sessions
FOR SELECT
USING (
  auth.uid() = user_id OR user_id IS NULL
);

CREATE POLICY "Users can insert their own chat sessions"
ON public.chat_sessions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Users can update their own chat sessions"
ON public.chat_sessions
FOR UPDATE
USING (
  auth.uid() = user_id OR user_id IS NULL
)
WITH CHECK (
  auth.uid() = user_id
);

CREATE POLICY "Users can delete their own chat sessions"
ON public.chat_sessions
FOR DELETE
USING (
  auth.uid() = user_id OR user_id IS NULL
);

-- Re-enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
