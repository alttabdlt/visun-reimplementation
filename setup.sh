#!/bin/bash

# Visun Setup Script
# This script helps set up Supabase and prepares for Vercel deployment

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}Visun Setup Script${NC}"
echo -e "${GREEN}=======================================${NC}\n"

# Check if required tools are installed
echo -e "${YELLOW}Checking required tools...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js and try again.${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install npm and try again.${NC}"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo -e "${RED}git is not installed. Please install git and try again.${NC}"
    exit 1
fi

echo -e "${GREEN}All required tools are installed.${NC}\n"

# Install Supabase CLI if not already installed
echo -e "${YELLOW}Checking for Supabase CLI...${NC}"
if ! command -v supabase &> /dev/null; then
    echo -e "Supabase CLI not found. Installing..."
    npm install -g supabase
else
    echo -e "${GREEN}Supabase CLI already installed.${NC}"
fi

# Install Vercel CLI if not already installed
echo -e "${YELLOW}Checking for Vercel CLI...${NC}"
if ! command -v vercel &> /dev/null; then
    echo -e "Vercel CLI not found. Installing..."
    npm install -g vercel
else
    echo -e "${GREEN}Vercel CLI already installed.${NC}"
fi

# Setup menu
while true; do
    echo -e "\n${GREEN}=======================================${NC}"
    echo -e "${GREEN}Setup Options:${NC}"
    echo -e "${GREEN}=======================================${NC}"
    echo -e "1) Install dependencies"
    echo -e "2) Set up Supabase locally"
    echo -e "3) Push database migrations to Supabase"
    echo -e "4) Prepare for Vercel deployment"
    echo -e "5) Test local environment"
    echo -e "6) Exit"
    
    read -p "Select an option (1-6): " option
    
    case $option in
        1)
            echo -e "\n${YELLOW}Installing dependencies...${NC}"
            cd visun-vercel
            npm install
            echo -e "${GREEN}Dependencies installed successfully.${NC}"
            ;;
        2)
            echo -e "\n${YELLOW}Setting up Supabase locally...${NC}"
            cd supabase
            
            # Check if Supabase is already running
            if supabase status &> /dev/null; then
                echo -e "${YELLOW}Supabase is already running.${NC}"
            else
                echo -e "Starting Supabase..."
                supabase start
            fi
            
            echo -e "${GREEN}Supabase setup complete.${NC}"
            ;;
        3)
            echo -e "\n${YELLOW}Pushing database migrations to Supabase...${NC}"
            
            # Check if we have a project reference
            read -p "Do you have a Supabase project reference? (y/n): " has_ref
            
            if [ "$has_ref" = "y" ] || [ "$has_ref" = "Y" ]; then
                read -p "Enter your Supabase project reference: " project_ref
                
                cd supabase
                supabase login
                supabase link --project-ref $project_ref
                supabase db push
                
                echo -e "${GREEN}Database migrations pushed successfully.${NC}"
            else
                echo -e "${YELLOW}To push migrations, you need a Supabase project.${NC}"
                echo -e "1) Go to https://supabase.com and create a project"
                echo -e "2) Get the project reference from the project settings"
                echo -e "3) Run this option again with the project reference"
            fi
            ;;
        4)
            echo -e "\n${YELLOW}Preparing for Vercel deployment...${NC}"
            
            # Create .env file if it doesn't exist
            if [ ! -f "visun-vercel/.env" ]; then
                echo -e "${YELLOW}Creating .env file...${NC}"
                cp visun-vercel/.env.example visun-vercel/.env
                echo -e "${GREEN}.env file created. Please edit it with your credentials.${NC}"
                echo -e "Open visun-vercel/.env in your text editor and add your credentials."
            fi
            
            # Verify git setup
            if [ ! -d ".git" ]; then
                echo -e "${YELLOW}Initializing git repository...${NC}"
                git init
                git add .
                git commit -m "Initial commit"
                
                echo -e "${GREEN}Git repository initialized.${NC}"
                echo -e "${YELLOW}Next steps:${NC}"
                echo -e "1) Create a GitHub repository"
                echo -e "2) Connect this repository with:"
                echo -e "   git remote add origin https://github.com/yourusername/your-repo.git"
                echo -e "   git branch -M main"
                echo -e "   git push -u origin main"
                echo -e "3) Go to vercel.com to deploy from your GitHub repository"
            else
                echo -e "${GREEN}Git repository already initialized.${NC}"
                echo -e "${YELLOW}Make sure to push your changes to GitHub:${NC}"
                echo -e "   git add ."
                echo -e "   git commit -m 'Your commit message'"
                echo -e "   git push"
            fi
            ;;
        5)
            echo -e "\n${YELLOW}Testing local environment...${NC}"
            
            # Check if .env file exists
            if [ ! -f "visun-vercel/.env" ]; then
                echo -e "${RED}No .env file found. Please run option 4 first and configure your .env file.${NC}"
                continue
            fi
            
            cd visun-vercel
            echo -e "${YELLOW}Starting development server...${NC}"
            echo -e "${YELLOW}Press Ctrl+C to stop the server when finished testing.${NC}"
            npm run dev
            ;;
        6)
            echo -e "\n${GREEN}Exiting setup script. Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "\n${RED}Invalid option. Please select a number between 1 and 6.${NC}"
            ;;
    esac
done
