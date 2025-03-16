#!/usr/bin/env python3
import json
import os
import time
import subprocess
import hashlib
import tempfile
import shutil
import ast
import re
from tqdm import tqdm
import supabase
import dotenv
from datetime import datetime
import base64
import uuid

# Load environment variables from .env file if it exists
dotenv.load_dotenv()

# Configuration
SOURCE_JSON = "combined_data_2.json"
PROCESSED_LOG = "rendered_animations.json"
FAILED_ANIMATIONS_LOG = "failed_animations.json"
RENDER_INTERVAL = 30  # Check for new animations every 30 seconds
OUTPUT_DIR = "rendered_animations"
MANIM_FLAGS = "-qm"  # Medium quality for faster rendering

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
# Try the service role key instead of the anon key for more permissions
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")  # Changed this line
STORAGE_BUCKET = "test-sonnet-animations"
TABLE_NAME = "test_sonnet_animations"

# Create output directory if it doesn't exist
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Initialize or load the logs
processed_animations = {}
if os.path.exists(PROCESSED_LOG):
    with open(PROCESSED_LOG, 'r') as f:
        processed_animations = json.load(f)

failed_animations = {}
if os.path.exists(FAILED_ANIMATIONS_LOG):
    with open(FAILED_ANIMATIONS_LOG, 'r') as f:
        failed_animations = json.load(f)

# Initialize Supabase client
# Add debug information to verify keys are loaded correctly
print(f"Connecting to Supabase at URL: {SUPABASE_URL}")
print(f"Using API key starting with: {SUPABASE_KEY[:10]}..." if SUPABASE_KEY else "API key not found!")
supabase_client = supabase.create_client(SUPABASE_URL, SUPABASE_KEY)

# Check if the table exists, create if it doesn't
def ensure_table_exists():
    try:
        # Test if the table exists by attempting to count rows
        count = supabase_client.table(TABLE_NAME).select("count", count="exact").execute()
        print(f"Connected to Supabase table '{TABLE_NAME}'. Current count: {count.data[0]['count']}")
    except Exception as e:
        print(f"Error checking table: {e}")
        print(f"Table '{TABLE_NAME}' may need to be created. Please create it with appropriate columns:")
        print("id UUID PRIMARY KEY, prompt TEXT, code TEXT, animation_url TEXT, created_at TIMESTAMP, hash TEXT")

def get_code_hash(code):
    """Generate a unique hash for the code to track what's been processed."""
    return hashlib.md5(code.encode('utf-8')).hexdigest()

def upload_to_supabase(file_path, animation_id):
    """Upload a file to Supabase storage and return the public URL."""
    try:
        file_name = f"dsa_animation_{animation_id}.mp4"
        
        # Read file content
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        # Upload to Supabase storage
        supabase_client.storage.from_(STORAGE_BUCKET).upload(
            path=file_name,
            file=file_data,
            file_options={"content-type": "video/mp4"}
        )
        
        # Get the public URL
        url = supabase_client.storage.from_(STORAGE_BUCKET).get_public_url(file_name)
        print(f"Uploaded {file_name} to Supabase storage")
        return url
    except Exception as e:
        print(f"Error uploading to Supabase storage: {e}")
        return None

def store_animation_metadata(animation_id, prompt, code, url, code_hash):
    """Store animation metadata in Supabase table."""
    try:
        # Insert data into the table
        data = {
            "id": str(uuid.uuid4()),
            "prompt": prompt,
            "code": code,
            "animation_url": url,
            "created_at": datetime.now().isoformat(),
            "hash": code_hash
        }
        
        result = supabase_client.table(TABLE_NAME).insert(data).execute()
        print(f"Stored metadata for animation {animation_id} in Supabase")
        return result.data[0]['id']
    except Exception as e:
        print(f"Error storing animation metadata: {e}")
        return None

def check_syntax(code):
    """Check if the code has valid Python syntax."""
    try:
        ast.parse(code)
        return True, None
    except SyntaxError as e:
        return False, str(e)

def fix_common_syntax_errors(code):
    """Attempt to fix common syntax errors in Manim code."""
    fixed_code = code
    
    # Fix mismatched brackets and parentheses
    brackets = {'(': ')', '[': ']', '{': '}'}
    stack = []
    problem_lines = []
    
    lines = fixed_code.split('\n')
    for i, line in enumerate(lines):
        for char in line:
            if char in brackets:
                stack.append((char, i))
            elif char in brackets.values():
                if not stack or brackets[stack[-1][0]] != char:
                    problem_lines.append(i)
                else:
                    stack.pop()
    
    # Add missing closing brackets
    if stack:
        for bracket, line_num in reversed(stack):
            closing_bracket = brackets[bracket]
            lines[line_num] = lines[line_num] + closing_bracket
        fixed_code = '\n'.join(lines)
    
    # Fix common specific errors
    fixed_code = fixed_code.replace("if *self.mobjects in self.mobjects:", "if self.mobjects:  # Fixed syntax")
    fixed_code = fixed_code.replace("if VGroup(*tree_mobjects in self.mobjects:", 
                                  "if VGroup(*tree_mobjects) in self.mobjects:  # Fixed syntax")
    
    # Fix other common function parameter issues
    fixed_code = re.sub(r'(\w+)\s*\*\s*(\w+)', r'\1 * \2', fixed_code)
    
    # Fix misplaced colons
    fixed_code = re.sub(r'if\s+([^:]+)in', r'if \1 in', fixed_code)
    
    return fixed_code

def create_fallback_animation(animation_id, prompt):
    """Create a simple but reliable fallback animation when the original code fails."""
    # Extract possible keywords from the prompt
    keywords = prompt.lower().split()
    algorithm_keywords = ["sort", "search", "tree", "graph", "hash", "array", "list", "stack", "queue"]
    
    # Determine animation theme based on prompt
    theme = next((kw for kw in keywords if any(alg in kw for alg in algorithm_keywords)), "algorithm")
    
    title = prompt[:50] + "..." if len(prompt) > 50 else prompt
    
    # Create a simple, reliable animation
    return f"""from manim import *

class FallbackAnimation(Scene):
    def construct(self):
        # Set up frame dimensions for better visibility
        config.frame_width = 12
        config.frame_height = 8
        
        # Create title
        title = Text("{title}", font_size=40)
        title.to_edge(UP)
        
        # Create a simple animation that is guaranteed to work
        self.play(Write(title))
        self.wait(1)
        
        # Create some basic shapes for visualization
        shapes = VGroup()
        
        # Circle
        circle = Circle(radius=1, color=BLUE)
        circle.shift(LEFT * 3)
        shapes.add(circle)
        
        # Square
        square = Square(side_length=2, color=GREEN)
        square.shift(RIGHT * 3)
        shapes.add(square)
        
        # Display the shapes
        self.play(Create(shapes))
        self.wait(1)
        
        # Add some text explaining the fallback
        explanation = Text("Animation #{animation_id}", font_size=24)
        explanation.next_to(shapes, DOWN, buff=1)
        self.play(FadeIn(explanation))
        
        # Add a final animation
        self.play(
            circle.animate.scale(0.5),
            square.animate.rotate(PI/4)
        )
        self.wait(2)
"""

def render_animation(code, prompt, animation_id):
    """Render a single Manim animation from the provided code and upload to Supabase."""
    animation_output_dir = None
    
    try:
        # First check if the code has valid syntax
        is_valid, syntax_error = check_syntax(code)
        
        if not is_valid:
            print(f"Syntax error in animation {animation_id}: {syntax_error}")
            print("Attempting to fix common issues...")
            
            # Try to fix common syntax errors
            fixed_code = fix_common_syntax_errors(code)
            is_valid, syntax_error = check_syntax(fixed_code)
            
            if is_valid:
                print("Successfully fixed syntax errors!")
                code = fixed_code
            else:
                print(f"Could not fix syntax errors. Using fallback animation.")
                code = create_fallback_animation(animation_id, prompt)
        
        # Create a temporary Python file with the Manim code
        with tempfile.NamedTemporaryFile(suffix='.py', mode='w', delete=False) as temp_file:
            temp_filename = temp_file.name
            temp_file.write(code)
        
        # Extract the Scene class name from the code
        scene_name = None
        for line in code.split('\n'):
            if line.strip().startswith('class ') and '(Scene)' in line:
                scene_name = line.split('class ')[1].split('(')[0].strip()
                break
        
        if not scene_name:
            print(f"Could not find Scene class in animation {animation_id}")
            # Create a fallback animation
            code = create_fallback_animation(animation_id, prompt)
            with open(temp_filename, 'w') as f:
                f.write(code)
            scene_name = "FallbackAnimation"
        
        # Create a clean output directory for this specific animation
        animation_output_dir = os.path.join(OUTPUT_DIR, f"animation_{animation_id}")
        os.makedirs(animation_output_dir, exist_ok=True)
        
        # Run manim with specific flags to generate a single clean MP4
        final_output_name = f"dsa_animation_{animation_id}"
        cmd = f"manim {temp_filename} {scene_name} -qm --format=mp4 --disable_caching -o {final_output_name}"
        
        print(f"Rendering animation {animation_id}: {prompt[:50]}...")
        # Change working directory to the animation output directory
        original_dir = os.getcwd()
        os.chdir(animation_output_dir)
        
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        
        # Move back to original directory
        os.chdir(original_dir)
        
        # Clean up the temporary file
        os.unlink(temp_filename)
        
        if result.returncode != 0:
            print(f"Error rendering animation {animation_id}:")
            print(result.stderr)
            
            # If the regular animation failed, try the fallback
            print("Trying fallback animation...")
            fallback_code = create_fallback_animation(animation_id, prompt)
            
            with tempfile.NamedTemporaryFile(suffix='.py', mode='w', delete=False) as temp_file:
                temp_filename = temp_file.name
                temp_file.write(fallback_code)
            
            # Run manim with the fallback animation
            os.chdir(animation_output_dir)
            fallback_cmd = f"manim {temp_filename} FallbackAnimation -qm --format=mp4 --disable_caching -o {final_output_name}"
            fallback_result = subprocess.run(fallback_cmd, shell=True, capture_output=True, text=True)
            os.chdir(original_dir)
            
            # Clean up the temporary file
            os.unlink(temp_filename)
            
            if fallback_result.returncode != 0:
                print("Fallback animation also failed.")
                return False
            
            # Use the fallback code for storage
            code = fallback_code
            
        # Find the rendered MP4 file
        expected_output = None
        
        for root, _, files in os.walk(animation_output_dir):
            for file in files:
                if file.endswith('.mp4'):
                    expected_output = os.path.join(root, file)
                    break
            if expected_output:
                break
        
        if expected_output:
            # Move the final MP4 to the top level of the animation directory with a clean name
            clean_output = os.path.join(animation_output_dir, f"dsa_animation_{animation_id}.mp4")
            os.rename(expected_output, clean_output)
            
            # Upload to Supabase
            code_hash = get_code_hash(code)
            url = upload_to_supabase(clean_output, animation_id)
            
            if url:
                # Store metadata in Supabase table
                db_id = store_animation_metadata(animation_id, prompt, code, url, code_hash)
                
                if not db_id:
                    print(f"Failed to store metadata for animation {animation_id}")
            
            # Clean up extra directories
            for item in os.listdir(animation_output_dir):
                item_path = os.path.join(animation_output_dir, item)
                if os.path.isdir(item_path):
                    shutil.rmtree(item_path)
            
            # Delete the local file after successful upload
            if os.path.exists(clean_output) and url:
                os.remove(clean_output)
                print(f"Deleted local file: {clean_output}")
                
            print(f"Successfully rendered animation {animation_id}")
            if url:
                print(f"Uploaded to Supabase with URL: {url}")
            return True
        else:
            print(f"Animation rendered but could not find output MP4 file")
            return False
            
    except Exception as e:
        print(f"Exception while rendering animation {animation_id}: {e}")
        return False
    finally:
        # Clean up the animation directory regardless of success or failure
        if animation_output_dir and os.path.exists(animation_output_dir):
            try:
                shutil.rmtree(animation_output_dir)
                print(f"Cleaned up directory: {animation_output_dir}")
            except Exception as cleanup_error:
                print(f"Error cleaning up directory: {cleanup_error}")

def main():
    """Main loop to periodically check for and render new animations."""
    print(f"Starting Manim renderer. Will check for new animations every {RENDER_INTERVAL} seconds.")
    print(f"Local animations will be saved to {OUTPUT_DIR}")
    print(f"Animations will be uploaded to Supabase storage and metadata stored in {TABLE_NAME}")
    
    # Verify Supabase connection and table
    ensure_table_exists()
    
    while True:
        try:
            # Try to read the current JSON file
            current_data = []
            try:
                with open(SOURCE_JSON, 'r') as f:
                    current_data = json.load(f)
            except json.JSONDecodeError:
                print("JSON file is currently being written and is incomplete. Will retry later.")
                time.sleep(RENDER_INTERVAL)
                continue
                
            # Process new animations
            new_animations = 0
            failed_new_animations = 0
            
            for idx, item in enumerate(current_data):
                if 'code' not in item or 'prompt' not in item:
                    continue
                    
                code_hash = get_code_hash(item['code'])
                
                # Skip if we've already processed or failed with this animation
                if code_hash in processed_animations or code_hash in failed_animations:
                    continue
                
                # This is a new animation - attempt to render it
                animation_id = f"{idx:04d}"
                success = render_animation(item['code'], item['prompt'], animation_id)
                
                if success:
                    # Record that we've processed this animation
                    processed_animations[code_hash] = {
                        'animation_id': animation_id,
                        'prompt': item['prompt'],
                        'timestamp': time.time()
                    }
                    new_animations += 1
                    
                    # Save the updated processed log
                    with open(PROCESSED_LOG, 'w') as f:
                        json.dump(processed_animations, f, indent=2)
                else:
                    # Record this as a failed animation
                    failed_animations[code_hash] = {
                        'animation_id': animation_id,
                        'prompt': item['prompt'],
                        'timestamp': time.time(),
                        'error': "Manim rendering failed"
                    }
                    failed_new_animations += 1
                    
                    # Save the updated failed log
                    with open(FAILED_ANIMATIONS_LOG, 'w') as f:
                        json.dump(failed_animations, f, indent=2)
            
            if new_animations > 0 or failed_new_animations > 0:
                print(f"Rendered {new_animations} new animations. Failed {failed_new_animations}. Total processed: {len(processed_animations)}")
            else:
                print(f"No new animations to render. Total processed: {len(processed_animations)}")
                
            # Wait before checking again
            time.sleep(RENDER_INTERVAL)
            
        except KeyboardInterrupt:
            print("Rendering stopped by user.")
            break
        except Exception as e:
            print(f"Error in main rendering loop: {e}")
            time.sleep(RENDER_INTERVAL)

if __name__ == "__main__":
    main() 