import os
import subprocess
import tempfile
import requests
import json
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()

# Get Supabase credentials
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")

def main():
    print("Creating placeholder animation...")
    
    # Create a temporary directory
    with tempfile.TemporaryDirectory() as tempdir:
        # Path for the placeholder animation
        temp_path = os.path.join(tempdir, "placeholder.mp4")
        
        # Generate a placeholder animation using ffmpeg
        cmd = [
            "ffmpeg", "-f", "lavfi", "-i", "color=c=blue:s=640x360:d=3", 
            "-vf", "drawtext=text='Loading Animation...':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=(h-text_h)/2",
            "-y", temp_path
        ]
        
        try:
            subprocess.run(cmd, check=True)
            print(f"Generated temporary placeholder at {temp_path}")
            
            # Also create a local copy in the media directory
            if not os.path.exists("media"):
                os.makedirs("media", exist_ok=True)
            
            local_path = os.path.join("media", "placeholder-animation.mp4")
            cmd = ["cp", temp_path, local_path]
            subprocess.run(cmd, check=True)
            print(f"Created local copy at {local_path}")
            
            # Try to upload to Supabase using Python client
            try:
                from supabase import create_client
                
                if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
                    print("Uploading to Supabase using Python client...")
                    
                    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
                    
                    # List available buckets
                    bucket_response = requests.get(
                        f"{SUPABASE_URL}/storage/v1/bucket",
                        headers={
                            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                            "Content-Type": "application/json"
                        }
                    )
                    
                    if bucket_response.status_code == 200:
                        buckets = bucket_response.json()
                        print(f"Available buckets: {[b['name'] for b in buckets]}")
                        
                        # Create animations bucket if it doesn't exist
                        if not any(b["name"] == "animations" for b in buckets):
                            print("Creating animations bucket...")
                            create_bucket_response = requests.post(
                                f"{SUPABASE_URL}/storage/v1/bucket",
                                headers={
                                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                                    "Content-Type": "application/json"
                                },
                                json={
                                    "name": "animations",
                                    "public": True
                                }
                            )
                            
                            if create_bucket_response.status_code in (200, 201):
                                print("Created animations bucket successfully")
                            else:
                                print(f"Failed to create bucket: {create_bucket_response.status_code} - {create_bucket_response.text}")
                    else:
                        print(f"Failed to list buckets: {bucket_response.status_code} - {bucket_response.text}")
                    
                    # Try to upload the file using the Python client
                    with open(temp_path, 'rb') as f:
                        file_data = f.read()
                        res = supabase.storage.from_("animations").upload(
                            "placeholder-animation.mp4",
                            file_data,
                            {"content-type": "video/mp4"}
                        )
                        
                        print(f"Upload result: {res}")
                        print(f"Public URL: {SUPABASE_URL}/storage/v1/object/public/animations/placeholder-animation.mp4")
                else:
                    print("Supabase credentials not available")
            except Exception as e:
                print(f"Error uploading to Supabase with Python client: {e}")
                
                # Try direct API upload
                try:
                    print("Trying direct API upload...")
                    
                    # Create bucket if it doesn't exist
                    create_bucket_response = requests.post(
                        f"{SUPABASE_URL}/storage/v1/bucket",
                        headers={
                            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "name": "animations",
                            "public": True
                        }
                    )
                    
                    # Upload file
                    with open(temp_path, 'rb') as f:
                        upload_response = requests.post(
                            f"{SUPABASE_URL}/storage/v1/object/animations/placeholder-animation.mp4",
                            headers={
                                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                                "Content-Type": "video/mp4"
                            },
                            data=f.read()
                        )
                        
                        if upload_response.status_code in (200, 201):
                            print("Successfully uploaded via direct API!")
                            print(f"Public URL: {SUPABASE_URL}/storage/v1/object/public/animations/placeholder-animation.mp4")
                        else:
                            print(f"Direct API upload failed: {upload_response.status_code} - {upload_response.text}")
                except Exception as api_error:
                    print(f"Error with direct API upload: {api_error}")
        
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    main()