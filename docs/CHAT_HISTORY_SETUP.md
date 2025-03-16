# Chat History Feature Setup

This document explains how to set up the chat history feature in the Render application using Supabase.

## Database Tables

The chat history feature requires two tables in Supabase:

1. `chat_sessions` - Stores information about each chat session
2. `chat_messages` - Stores the individual messages for each session

## Setup Instructions

### 1. Create the Database Tables

Run the following SQL scripts in your Supabase SQL Editor:

First, create the `chat_sessions` table:

```sql
-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  first_message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON public.chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON public.chat_sessions(created_at);

-- Add RLS policies
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now (you can restrict this later)
CREATE POLICY "Allow all operations for now" 
ON public.chat_sessions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Grant access to the anon role
GRANT ALL ON public.chat_sessions TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.chat_sessions_id_seq TO anon;

-- Create a trigger to update the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_chat_sessions_updated_at
BEFORE UPDATE ON public.chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

Then, create the `chat_messages` table:

```sql
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

-- Create a policy that allows all operations for now (you can restrict this later)
CREATE POLICY "Allow all operations for now" 
ON public.chat_messages 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Grant access to the anon role
GRANT ALL ON public.chat_messages TO anon;
GRANT USAGE, SELECT ON SEQUENCE public.chat_messages_id_seq TO anon;

-- Create a trigger to update the updated_at column
CREATE TRIGGER update_chat_messages_updated_at
BEFORE UPDATE ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

### 2. Update Supabase Types (if using TypeScript)

Make sure your Supabase types include the new tables:

```typescript
export type Database = {
  public: {
    Tables: {
      // ... other tables
      chat_sessions: {
        Row: {
          id: number
          session_id: string
          first_message: string
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: number
          session_id?: string
          first_message: string
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: number
          session_id?: string
          first_message?: string
          created_at?: string
          updated_at?: string | null
        }
      }
      chat_messages: {
        Row: {
          id: number
          session_id: string
          user_query: string
          ai_response: Json
          animation_status: string | null
          animation_url: Json | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: number
          session_id: string
          user_query: string
          ai_response: Json
          animation_status?: string | null
          animation_url?: Json | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: number
          session_id?: string
          user_query?: string
          ai_response?: Json
          animation_status?: string | null
          animation_url?: Json | null
          created_at?: string
          updated_at?: string | null
        }
      }
    }
    // ... rest of the types
  }
}
```

## Feature Components

The chat history feature consists of the following components:

1. **ChatSidebar** - Displays the list of previous chat sessions
2. **Header** - Contains the button to toggle the ChatSidebar
3. **Chat Page** - Handles loading and saving chat sessions

## Usage

1. When a user starts a new chat and sends their first message, a new chat session is created
2. The session ID is added to the URL as a query parameter
3. Users can access their chat history by clicking the history button in the header
4. Clicking on a chat session in the sidebar will load that conversation

## Security Considerations

The current implementation uses Row Level Security (RLS) policies that allow all operations. In a production environment, you should modify these policies to restrict access based on user authentication.
