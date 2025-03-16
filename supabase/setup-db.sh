#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}Supabase Database Setup Script${NC}"
echo -e "${GREEN}=======================================${NC}\n"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}Supabase CLI not found. Installing...${NC}"
    npm install -g supabase
fi

# Prompt for project reference
read -p "Enter your Supabase project reference (from Project Settings): " project_ref

# Login to Supabase
echo -e "${YELLOW}Logging in to Supabase...${NC}"
supabase login

# Link project
echo -e "${YELLOW}Linking project...${NC}"
supabase link --project-ref $project_ref

# Push database changes
echo -e "${YELLOW}Pushing database migrations...${NC}"
supabase db push

echo -e "${GREEN}Database setup complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Configure authentication providers in the Supabase dashboard"
echo -e "2. Set up your frontend .env file with the Supabase credentials"
echo -e "3. Deploy your application to Vercel${NC}"
