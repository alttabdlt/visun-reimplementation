# Visun Vercel Deployment Guide

This guide provides instructions for deploying the Visun application to Vercel and setting up the necessary Supabase resources.

## Prerequisites

- Node.js 18.x or later
- npm or yarn
- A Supabase account
- A Vercel account
- OpenAI API key

## Local Development Setup

1. Create a `.env.local` file in the project root with the following variables:

```
# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=https://xavafuqrqucwbjxxcgqk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI configuration
OPENAI_API_KEY=your-openai-api-key

# Vercel Blob Storage (for animations)
BLOB_READ_WRITE_TOKEN=your-blob-read-write-token

# Server port (development)
PORT=3001
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

## Supabase Configuration

### Database Schema

The application requires the following tables in Supabase:

1. `profiles` - User profile information
2. `chat_sessions` - Chat conversation sessions
3. `chat_messages` - Individual messages in chat sessions
4. `animation_code` - Stores the Manim code for animations

The schemas for these tables are defined in the SQL migration file located at:
`/supabase/migrations/create_tables.sql`

### Authentication Setup

1. In the Supabase dashboard, navigate to Authentication → Providers
2. Enable Email auth at minimum
3. Set your site URL and redirect URLs
4. (Optional) Set up additional auth providers like GitHub

## Deploying to Vercel

### Manual Deployment

1. Push your code to a GitHub repository
2. Log in to Vercel and create a new project
3. Import your GitHub repository
4. Set the following environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
5. Deploy the project

### Getting a Vercel Blob Storage Token

1. Install the Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Log in to Vercel:
   ```bash
   vercel login
   ```

3. Link your project:
   ```bash
   vercel link
   ```

4. Create a new Blob read/write token:
   ```bash
   vercel blob create-token
   ```

5. Add the token to your environment variables:
   ```bash
   vercel env add BLOB_READ_WRITE_TOKEN
   ```

## API Routes

The application includes the following API routes:

- `/api/chat` - Handles chat message processing
- `/api/generate-animation` - Generates Manim code for animations
- `/api/execute-manim` - Executes Manim code to create animations
- `/api/animation-status` - Gets the status of animation generation
- `/api/health` - Health check endpoint

## Troubleshooting

### Animation Generation Issues

If animations are not generating:

1. Check that your OpenAI API key is valid
2. Ensure Manim is properly installed in the Vercel environment
3. Check the Vercel function logs for errors

### Database Connection Issues

If you're having trouble connecting to Supabase:

1. Verify that your Supabase URL and API keys are correct
2. Check that the database tables are properly created
3. Ensure the RLS policies are configured correctly

### Deployment Failures

If deployment to Vercel fails:

1. Check the build logs for errors
2. Ensure all required environment variables are set
3. Verify that your project structure matches Vercel's requirements
