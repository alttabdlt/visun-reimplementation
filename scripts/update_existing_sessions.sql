-- This script assigns the current user's ID to any existing chat sessions that don't have a user_id
-- Replace 'YOUR_USER_ID' with your actual Supabase user ID

-- Get your user ID from Supabase Authentication section
-- You can also run this SQL to find your user ID:
-- SELECT id FROM auth.users LIMIT 1;

-- First let's see all sessions that need updating
SELECT * FROM public.chat_sessions WHERE user_id IS NULL;

-- Then disable RLS to update the sessions
ALTER TABLE public.chat_sessions DISABLE ROW LEVEL SECURITY;

-- Update all existing sessions without a user_id to belong to the current user
-- Replace 'YOUR_USER_ID' with your actual Supabase user ID
UPDATE public.chat_sessions
SET user_id = 'YOUR_USER_ID'
WHERE user_id IS NULL;

-- Re-enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Verify the update worked
SELECT * FROM public.chat_sessions;

-- Optional: Check existing policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd, 
  qual, 
  with_check
FROM 
  pg_policies 
WHERE 
  tablename = 'chat_sessions';
