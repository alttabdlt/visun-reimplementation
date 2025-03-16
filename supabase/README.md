# Supabase Configuration for Visun

This directory contains the Supabase configuration files and database migrations for the Visun application.

## Directory Structure

- `migrations/` - SQL migration files for setting up the database schema
- `functions/` - Edge Functions (serverless functions)
- `config.toml` - Configuration file for Supabase

## Database Setup

The `migrations/create_tables.sql` file contains the SQL statements to create the necessary tables, indexes, and Row Level Security (RLS) policies for the Visun application.

### Tables

1. **profiles** - User profile information
   - Links to Supabase auth.users
   - Stores username and avatar URL

2. **chat_sessions** - Chat conversation sessions
   - Linked to user profiles
   - Contains session metadata

3. **chat_messages** - Individual messages in chat sessions
   - Linked to chat sessions
   - Contains message content, role (user/assistant)
   - Stores animation metadata and status

### Triggers and Functions

The migration file also includes a trigger to automatically create a profile when a new user is created in the auth.users table.

## Setting Up Supabase

### Using the Setup Script

The easiest way to set up Supabase is to use the provided setup script:

```bash
./setup-db.sh
```

This script will:
1. Install the Supabase CLI if needed
2. Prompt for your Supabase project reference
3. Log in to Supabase
4. Link your local project to your Supabase project
5. Push the database migrations

### Manual Setup

If you prefer to set up Supabase manually:

1. Install the Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Log in to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Push the database migrations:
   ```bash
   supabase db push
   ```

## Authentication Setup

After setting up the database, you'll need to configure authentication in the Supabase dashboard:

1. Go to Authentication → Providers
2. Enable Email auth
3. (Optional) Enable additional providers like GitHub
4. Set your site URL and redirect URLs

## Environment Variables

Make sure to update the following environment variables in your frontend application:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

## Monitoring

You can monitor your Supabase project using the Supabase dashboard:

- Database usage and queries
- Authentication activity
- Storage usage
- Edge Function logs

## Troubleshooting

- If you encounter issues with migrations, check the Supabase dashboard for error messages
- Ensure your database URL and API keys are correct
- Verify that your RLS policies are properly configured
- Check the Supabase logs for any errors
