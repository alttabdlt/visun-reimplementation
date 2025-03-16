# Visun (formerly Chat Animation Hub)

A platform for generating and displaying mathematical concept animations powered by AI.

## Project Structure

- `visun-vercel/` - Next.js frontend with dark blue theme, deployed on Vercel
- `manim-service/` - Python backend service for generating animations using Manim
- `supabase/` - Database schema, migrations, and Edge Functions

## Development

### Frontend (Next.js)

```bash
# Install dependencies
cd visun-vercel
npm install

# Run the frontend development server
npm run dev
```

### Database (Supabase)

```bash
# Set up Supabase database
cd supabase
./setup-db.sh
```

### Backend (Manim Service)

```bash
# Install requirements
pip install -r manim-service/requirements.txt

# Run locally (optional)
cd manim-service && python wsgi.py

# Run tests
cd manim-service && python tests/test_manim.py <SceneName>
```

## Deployment

### Frontend (Vercel)

See the detailed deployment guide in `visun-vercel/README-DEPLOYMENT.md` or follow these steps:

1. Push the code to a GitHub repository
2. Connect the repository to Vercel
3. Configure the necessary environment variables
4. Deploy!

### Database (Supabase)

1. Create a Supabase project
2. Run the database migrations from `supabase/migrations/create_tables.sql`
3. Configure authentication settings

## Features

- AI-powered explanations of complex concepts
- Mathematical animation generation with Manim
- Real-time updates of animation generation status
- Multi-step animations with navigation
- Dark mode with blue tint theme
- Authentication with Supabase
- Animation storage with Vercel Blob Storage

## Setup Script

For convenience, a setup script is provided that helps with common tasks:

```bash
./setup.sh
```

## Environment Variables

See `visun-vercel/.env.example` for required environment variables.