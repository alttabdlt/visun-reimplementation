import os
import json
import sys
import requests
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables
load_dotenv()

# Get Supabase credentials
url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not url or not key:
    print('Missing Supabase credentials')
    sys.exit(1)

# Initialize Supabase client
supabase = create_client(url, key)

# Check if the placeholder animation is accessible
try:
    placeholder_url = "https://manim-service-589284378993.us-central1.run.app/placeholder-animation.mp4"
    print(f"Checking accessibility of placeholder animation at: {placeholder_url}")
    response = requests.get(placeholder_url, timeout=5)
    print(f"Status code: {response.status_code}")
    print(f"Content-Type: {response.headers.get('Content-Type')}")
    print(f"Content-Length: {response.headers.get('Content-Length')}")
    
    # Check Manim service health
    health_url = "https://manim-service-589284378993.us-central1.run.app/health"
    print(f"\nChecking Manim service health at: {health_url}")
    health_response = requests.get(health_url, timeout=5)
    print(f"Status code: {health_response.status_code}")
    if health_response.ok:
        print(f"Health response: {health_response.json()}")
    
    # Query the chat_messages table
    print("\nQuerying chat_messages table:")
    result = supabase.table('chat_messages').select('*').order('created_at', desc=True).limit(10).execute()
    
    if result.data:
        # Print the schema (field names and types)
        schema = {k: type(v).__name__ for k, v in result.data[0].items()}
        print("Schema:")
        print(json.dumps(schema, indent=2))
        
        # Print a sample record to see the actual values
        print("\nSample Record:")
        print(json.dumps(result.data[0], indent=2))
        
        # Check animation URLs specifically
        print("\nAnimation URLs in database:")
        for message in result.data:
            if 'animation_url' in message and message['animation_url']:
                print(f"ID: {message['id']}, URLs: {json.dumps(message['animation_url'], indent=2)}")
    else:
        print('No data found in chat_messages table')
except Exception as e:
    print(f"Error: {e}") 