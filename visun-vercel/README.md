# Visun - AI Chat with Animations

Visun is an AI-powered chat application that automatically generates visual animations to help explain concepts. This project is built with Next.js and uses Supabase for authentication and data storage, while leveraging Vercel's serverless functions for animation generation.

## Key Features

- AI-powered chat with automatic visual explanations
- Animations rendered using Manim (Mathematical Animation Engine)
- Real-time chat message updates
- Dark and light mode with theme persistence
- Complete user authentication system
- Chat history management

## Tech Stack

- **Frontend**: Next.js 15.2.0, React, Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **Authentication & Database**: Supabase
- **Animation**: Manim (Python)
- **API Integration**: OpenAI GPT-4 Turbo
- **File Storage**: Vercel Blob Storage

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+ with Manim installed (for local animation rendering)
- Supabase account and project
- OpenAI API key
- Vercel account (for deployment)

### Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Copy the environment variables:

```bash
cp .env.example .env.local
```

4. Fill in your environment variables in `.env.local`

5. Start the development server:

```bash
npm run dev
```

The application will be available at [http://localhost:3001](http://localhost:3001)

## Database Schema

Visun uses the following Supabase tables:

- **users** - User authentication (managed by Supabase Auth)
- **user_preferences** - User settings including theme preference
- **chat_sessions** - Chat sessions/conversations
- **chat_messages** - Individual messages within chat sessions
- **animation_code** - Generated Manim code for animations

## Deployment

This project is designed to be deployed to Vercel, with animation processing handled by Vercel Functions.

```bash
vercel deploy
```

## Environment Variables

See `.env.example` for required environment variables.

## License

MIT
