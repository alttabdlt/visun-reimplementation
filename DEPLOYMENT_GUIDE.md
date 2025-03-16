# Visun Deployment Guide

## Local Development Setup

### 1. Setup Environment Variables

Create a `.env` file in the `visun-vercel` directory with the following variables:

```
# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# OpenAI configuration
OPENAI_API_KEY=your-openai-api-key

# Vercel Blob Storage (for animations)
BLOB_READ_WRITE_TOKEN=your-blob-read-write-token

# Server port (development)
PORT=3001
```

Replace the placeholder values with your actual credentials.

### 2. Install Dependencies

```bash
cd visun-vercel
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [Supabase](https://supabase.com/) and create a new project
2. Note your project URL and API keys from the API settings

### 2. Set Up Database Tables

Run the migration SQL script to create the necessary tables:

```bash
cd supabase
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

Alternatively, you can manually run the SQL from `supabase/migrations/create_tables.sql` in the Supabase SQL Editor.

### 3. Set Up Authentication

1. In the Supabase dashboard, go to Authentication → Settings
2. Enable Email Auth and any other providers you want to use
3. Configure Redirect URLs for your production domain

## Vercel Deployment

### 1. Push to GitHub

First, push your code to a GitHub repository:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/visun-reimplementation.git
git push -u origin main
```

### 2. Connect to Vercel

1. Go to [Vercel](https://vercel.com/) and create a new project
2. Import your GitHub repository
3. Configure the project:
   - Root Directory: `visun-vercel`
   - Build Command: `npm run build`
   - Output Directory: `.next`

### 3. Environment Variables

Add the following environment variables in the Vercel project settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `BLOB_READ_WRITE_TOKEN`

### 4. Deploy

Click "Deploy" and wait for the build to complete. Once deployed, your site will be available at the provided Vercel URL.

## Post-Deployment Tasks

### 1. Configure Supabase Authentication Redirect URLs

Update the redirect URLs in Supabase to include your Vercel deployment URL:

- Site URL: `https://your-vercel-deployment-url.vercel.app`
- Redirect URLs: `https://your-vercel-deployment-url.vercel.app/**`

### 2. Test the Application

1. Test user registration and login
2. Test chat functionality
3. Test animation generation
4. Verify dark mode persistence

## Troubleshooting

### Database Connection Issues

- Verify that your Supabase URL and API keys are correct
- Check that RLS policies are properly configured
- Look at Supabase logs for any errors

### Animation Generation Problems

- Verify that the OpenAI API key is valid
- Check for errors in the Vercel function logs
- Ensure the Vercel Blob storage is configured correctly

### Authentication Issues

- Check Supabase authentication settings
- Verify redirect URLs are properly configured
- Check browser console for any CORS errors
