#!/bin/bash
set -e

# Parse command line arguments
FULL_REBUILD=false
HELP=false

# Process command line arguments
for arg in "$@"
do
    case $arg in
        --full-rebuild)
        FULL_REBUILD=true
        shift
        ;;
        --help)
        HELP=true
        shift
        ;;
        *)
        # Unknown option
        ;;
    esac
done

# Display help information
if [ "$HELP" = true ]; then
    echo "Deploy script for Manim service"
    echo ""
    echo "Usage:"
    echo "  ./deploy.sh [options]"
    echo ""
    echo "Options:"
    echo "  --full-rebuild    Perform a full Docker rebuild and deployment"
    echo "  --help            Display this help message"
    echo ""
    echo "Without options, a quick deployment using the existing image is performed."
    exit 0
fi

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env file"
    # Export variables from .env file
    export $(grep -v '^#' .env | xargs)
fi

# Check for required environment variables
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in environment or .env file"
    echo "Supabase integration may not work properly."
fi

echo "Starting deployment to Google Cloud Run..."

if [ "$FULL_REBUILD" = true ]; then
    echo "Performing FULL REBUILD and deployment..."
    
    # Build and push the Docker image to Google Container Registry
    gcloud builds submit --tag gcr.io/$(gcloud config get-value project)/manim-service
fi

# Deploy to Cloud Run with environment variables
echo "Deploying to Google Cloud Run..."
gcloud run deploy manim-service \
  --image gcr.io/$(gcloud config get-value project)/manim-service \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --allow-unauthenticated \
  --set-env-vars="SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}"

echo "Deployment complete!" 