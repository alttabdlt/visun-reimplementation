# Chat History Feature Setup Instructions

## Error: "relation 'public.chat_sessions' does not exist"

You're seeing this error because the required database tables haven't been created in your Supabase project yet. Follow these steps to fix it:

## Creating the Tables in Supabase

1. **Open your Supabase Dashboard**:
   - Go to https://app.supabase.com/ and sign in
   - Select your project

2. **Open the SQL Editor**:
   - In the left sidebar, click on "SQL Editor"
   - Click "New Query" to create a new SQL query

3. **Create the `chat_sessions` table**:
   - Copy and paste the contents of the `scripts/create_chat_sessions_table.sql` file
   - Click "Run" to execute the SQL

4. **Create the `chat_messages` table**:
   - Create another new query
   - Copy and paste the contents of the `scripts/create_chat_messages_table.sql` file
   - Click "Run" to execute the SQL

5. **Verify the tables were created**:
   - In the left sidebar, click on "Table Editor"
   - You should see both `chat_sessions` and `chat_messages` tables listed

## Alternative Method: Using the Supabase CLI

If you have the Supabase CLI installed, you can run these commands:

```bash
# Navigate to your project directory
cd /Users/axel/Desktop/Coding-Projects/chat-animation-hub

# Run the SQL scripts
supabase db execute -f scripts/create_chat_sessions_table.sql
supabase db execute -f scripts/create_chat_messages_table.sql
```

## After Creating the Tables

Once you've created the tables:
1. Restart your development server
2. The chat sidebar should now work correctly

If you continue to experience issues, check the browser console for any additional error messages.
