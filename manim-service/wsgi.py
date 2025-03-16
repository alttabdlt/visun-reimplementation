from flask import Flask, jsonify, request, send_file, send_from_directory, redirect
import logging
import os
import datetime
import sys
import tempfile
import subprocess
import uuid
import re
import shutil
import hashlib
import json
from pathlib import Path
from dotenv import load_dotenv
import time
import io
from functools import wraps
import py_compile
import requests
import random

# Load environment variables from .env file if present
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Supabase client
try:
    from supabase import create_client, Client
    
    # Get Supabase credentials from environment
    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
    
    supabase = None
    
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        logger.info("Supabase client initialized successfully")
    else:
        if not SUPABASE_URL:
            logger.warning("SUPABASE_URL not found in environment")
        if not SUPABASE_SERVICE_ROLE_KEY:
            logger.warning("Neither SUPABASE_SERVICE_ROLE_KEY nor SUPABASE_ANON_KEY found in environment")
        logger.warning("Supabase credentials not found in environment. Storage features disabled.")
except ImportError:
    logger.warning("Supabase package not installed. Storage features disabled.")
    supabase = None

app = Flask(__name__)

# Create media directory if it doesn't exist
MEDIA_DIR = os.environ.get("MEDIA_DIR", os.path.join(os.getcwd(), "media"))
os.makedirs(MEDIA_DIR, exist_ok=True)
logger.info(f"Using media directory: {MEDIA_DIR}")

# Create cache directory if it doesn't exist
CACHE_DIR = os.environ.get("CACHE_DIR", os.path.join(os.getcwd(), "cache"))
os.makedirs(CACHE_DIR, exist_ok=True)

# Helper function to set up a placeholder animation
def setup_placeholder_animation():
    PLACEHOLDER_PATH = os.path.join(MEDIA_DIR, "placeholder-animation.mp4")
    if os.path.exists(PLACEHOLDER_PATH):
        logger.info(f"Placeholder already exists at {PLACEHOLDER_PATH}")
        return PLACEHOLDER_PATH
    
    logger.info("Setting up placeholder animation")
    
    # Try to download from Supabase Storage first - most reliable
    try:
        placeholder_url = "https://xavafuqrqucwbjxxcgqk.supabase.co/storage/v1/object/public/animations/placeholder-animation.mp4"
        logger.info(f"Downloading placeholder from {placeholder_url}")
        
        response = requests.get(placeholder_url, timeout=10)
        if response.status_code == 200:
            with open(PLACEHOLDER_PATH, "wb") as f:
                f.write(response.content)
            logger.info(f"Downloaded placeholder from Supabase storage to {PLACEHOLDER_PATH}")
            return PLACEHOLDER_PATH
    except Exception as download_error:
        logger.error(f"Failed to download placeholder from Supabase: {download_error}")
    
    # Check if there's a static placeholder in the public directory
    static_placeholder = os.path.join(os.getcwd(), "public", "placeholder-animation.mp4")
    if os.path.exists(static_placeholder):
        # Copy the existing placeholder instead of generating one
        shutil.copy2(static_placeholder, PLACEHOLDER_PATH)
        logger.info(f"Copied static placeholder from public directory to {PLACEHOLDER_PATH}")
        return PLACEHOLDER_PATH
    
    # Try to generate a placeholder with ffmpeg
    try:
        cmd = [
            "ffmpeg", "-f", "lavfi", "-i", "color=c=blue:s=640x360:d=3", 
            "-vf", "drawtext=text='Loading Animation...':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=(h-text_h)/2",
            "-y", PLACEHOLDER_PATH
        ]
        subprocess.run(cmd, check=True, timeout=30)
        logger.info(f"Generated placeholder with ffmpeg to {PLACEHOLDER_PATH}")
        return PLACEHOLDER_PATH
    except Exception as e:
        logger.error(f"Failed to create placeholder animation: {e}")
        
        # Create a minimal fallback file
        try:
            with open(PLACEHOLDER_PATH, "wb") as f:
                f.write(bytes.fromhex('00000020667479704d503432000000010000000000000000'))
            logger.info("Created minimal placeholder file")
            return PLACEHOLDER_PATH
        except Exception as write_error:
            logger.error(f"Could not create minimal placeholder: {write_error}")
            return None

# Create placeholder animation
PLACEHOLDER_PATH = setup_placeholder_animation()

# Test Manim installation at startup
def test_manim_installation():
    try:
        import manim
        logger.info(f"Manim version: {manim.__version__}")
        
        # Create a simple test scene
        scene_code = """
from manim import *

class TestScene(Scene):
    def construct(self):
        circle = Circle()
        circle.set_fill(PINK, opacity=0.5)
        self.play(Create(circle))
        self.wait(1)

if __name__ == '__main__':
    TestScene().render()
"""
        
        with tempfile.TemporaryDirectory() as tempdir:
            # Save the code to a temporary file
            code_file = os.path.join(tempdir, "test_animation.py")
            with open(code_file, "w") as f:
                f.write(scene_code)
            
            # Run Manim with minimal settings
            command = [
                "python3", "-m", "manim", "render", code_file, "TestScene",  # Add "render" here
                "-ql",  # Low quality for quick test
                "--media_dir", tempdir,
                "--verbosity", "DEBUG"  # Use verbosity instead of verbose
            ]
            
            # Try to run the command
            try:
                result = subprocess.run(
                    command,
                    check=True,
                    timeout=30,
                    capture_output=True,
                    text=True
                )
                logger.info("Manim test animation completed successfully")
                
                # Check if output file was created
                output_files = []
                for root, dirs, files in os.walk(tempdir):
                    for file in files:
                        if file.endswith(".mp4"):
                            output_files.append(os.path.join(root, file))
                
                if output_files:
                    logger.info(f"Test animation generated {len(output_files)} MP4 files")
                    return True
                else:
                    logger.error("No MP4 files generated in test")
                    return False
                
            except Exception as e:
                logger.error(f"Manim test animation failed: {e}")
                if hasattr(e, "stdout") and e.stdout:
                    logger.error(f"Test stdout: {e.stdout[:500]}")
                if hasattr(e, "stderr") and e.stderr:
                    logger.error(f"Test stderr: {e.stderr[:500]}")
                return False
    except Exception as e:
        logger.error(f"Error testing Manim installation: {e}")
        return False

# Run the test
MANIM_WORKING = test_manim_installation()

# Define CORS headers
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, HEAD'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

# Handle exceptions in routes
def handle_exceptions(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Exception in {f.__name__}: {str(e)}", exc_info=True)
            response = jsonify({
                "success": False,
                "error": str(e),
                "url": f"{os.environ.get('MANIM_SERVICE_URL', 'https://manim-service-589284378993.us-central1.run.app')}/placeholder-animation.mp4"
            }), 500
            return add_cors_headers(response)
    return wrapper

# Handle preflight requests for all endpoints
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify({})
        return add_cors_headers(response)

@app.route("/", methods=["GET", "HEAD"])
def root():
    """Root endpoint for basic health checks"""
    logger.info(f"Health check request received from {request.remote_addr}")
    response = jsonify({"status": "healthy"})
    return add_cors_headers(response)

@app.route("/health", methods=["GET"])
def health():
    """Detailed health check endpoint"""
    logger.info(f"Detailed health check request received from {request.remote_addr}")
    
    response = jsonify({
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat(),
        "media_dir": MEDIA_DIR,
        "file_count": len(os.listdir(MEDIA_DIR)) if os.path.exists(MEDIA_DIR) else 0,
        "python_version": sys.version,
        "supabase_connected": supabase is not None,
        "manim_working": MANIM_WORKING,
        "manim_version": getattr(__import__('manim'), '__version__', 'unknown')
    })
    return add_cors_headers(response)

@app.route("/media/<path:filename>")
def serve_media(filename):
    """Serve media files from the media directory"""
    logger.info(f"Media request received for: {filename}")
    
    # Determine appropriate content type
    content_type = "application/octet-stream"  # Default
    if filename.endswith('.mp4'):
        content_type = "video/mp4"
    elif filename.endswith('.png'):
        content_type = "image/png"
    elif filename.endswith('.jpg') or filename.endswith('.jpeg'):
        content_type = "image/jpeg"
    
    # Check if file exists
    file_path = os.path.join(MEDIA_DIR, filename)
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        # For MP4 files, redirect to placeholder
        if filename.endswith('.mp4'):
            return redirect("https://xavafuqrqucwbjxxcgqk.supabase.co/storage/v1/object/public/animations/placeholder-animation.mp4")
        return jsonify({"error": "File not found"}), 404
    
    # Serve the file with proper content type
    response = send_from_directory(MEDIA_DIR, filename, mimetype=content_type)
    
    # Add CORS headers to the response
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Content-Type'] = content_type
    return response

@app.route("/placeholder-animation.mp4")
def serve_placeholder():
    """Serve the placeholder animation file"""
    if not PLACEHOLDER_PATH or not os.path.exists(PLACEHOLDER_PATH):
        logger.error("Placeholder animation not found")
        # Redirect to Supabase Storage URL instead of returning an error
        return redirect("https://xavafuqrqucwbjxxcgqk.supabase.co/storage/v1/object/public/animations/placeholder-animation.mp4")
    
    # Check if the file is empty or too small
    if os.path.getsize(PLACEHOLDER_PATH) < 1000:  # Less than 1KB is suspicious
        logger.error(f"Placeholder file exists but is too small: {os.path.getsize(PLACEHOLDER_PATH)} bytes")
        # Redirect to Supabase Storage URL as fallback
        return redirect("https://xavafuqrqucwbjxxcgqk.supabase.co/storage/v1/object/public/animations/placeholder-animation.mp4")
    
    logger.info(f"Serving placeholder animation from {PLACEHOLDER_PATH}")
    try:
        response = send_file(PLACEHOLDER_PATH, mimetype="video/mp4", as_attachment=False)
        # Add CORS headers to the response
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        # Ensure correct content type
        response.headers['Content-Type'] = 'video/mp4'
        return response
    except Exception as e:
        logger.error(f"Error serving placeholder file: {e}")
        # Redirect to Supabase Storage URL as fallback
        return redirect("https://xavafuqrqucwbjxxcgqk.supabase.co/storage/v1/object/public/animations/placeholder-animation.mp4")

# Cache functions
def store_in_cache(code, code_hash, video_url):
    """Store animation in cache for future use"""
    # Local storage (always works)
    if not os.path.exists(CACHE_DIR):
        os.makedirs(CACHE_DIR, exist_ok=True)
    
    cache_file = os.path.join(CACHE_DIR, f"{code_hash}.json")
    cache_data = {
        "code": code,
        "url": video_url,
        "timestamp": datetime.datetime.now().isoformat()
    }
    
    with open(cache_file, "w") as f:
        json.dump(cache_data, f)
    
    logger.info(f"Stored animation in cache with hash {code_hash}")
    
    # Supabase storage (if available)
    if supabase:
        try:
            # Check if the record already exists
            response = supabase.table('animation_cache').select('*').eq('query_hash', code_hash).execute()
            record_exists = response.data and len(response.data) > 0
            
            if record_exists:
                logger.info(f"Animation with hash {code_hash} already exists in cache, updating")
                # Use update instead of insert
                supabase.table('animation_cache').update({
                    "animation_url": video_url,
                    "manim_code": code
                }).eq("query_hash", code_hash).execute()
            else:
                # Insert new record
                supabase.table('animation_cache').insert({
                    "query_hash": code_hash,
                    "manim_code": code,
                    "animation_url": video_url,
                    "original_query": "Generated animation" # Default value to prevent null
                }).execute()
            
            # Also store the code file itself
            try:
                code_bytes = code.encode('utf-8')
                try:
                    # Try to get it first to check if it exists
                    supabase.storage.from_('manim-code').get(f"{code_hash}.py")
                    # Update existing file
                    supabase.storage.from_('manim-code').update(f"{code_hash}.py", code_bytes)
                except:
                    # Upload new file
                    supabase.storage.from_('manim-code').upload(f"{code_hash}.py", code_bytes)
            except Exception as storage_error:
                logger.error(f"Could not store code file (non-critical): {storage_error}")
            
            logger.info(f"Stored animation metadata in Supabase with hash {code_hash}")
        except Exception as e:
            logger.error(f"Error storing in Supabase: {e}")

def check_cache(code_hash):
    """Check if animation is in cache and return URL if found"""
    cache_file = os.path.join(CACHE_DIR, f"{code_hash}.json")
    
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                cache_data = json.load(f)
            
            url = cache_data.get("url")
            if url:
                logger.info(f"Found animation in cache with hash {code_hash}")
                return url
        except Exception as e:
            logger.error(f"Error reading from cache: {e}")
    
    return None

def fix_manim_code(code):
    """Fix common issues in Manim code to ensure proper rendering."""
    logger.info("Starting to fix manim code...")
    
    # Make a copy of the original code
    original_code = code
    
    # Detect if there's any Manim code at all
    has_manim_imports = 'import' in code and 'manim' in code
    has_scene_class = 'Scene' in code and 'class' in code
    
    # Only use fallback for completely invalid Manim code
    if not (has_manim_imports and has_scene_class):
        logger.info("Insufficient Manim structure, using fallback template")
        
        # Try to extract content from the original code if possible
        text_content = extract_text_content(original_code)
        if text_content:
            logger.info(f"Extracted content: {text_content}")
            return create_animation_with_content(text_content)
        else:
            return create_basic_animation_template()
    
    # Check for duplicate construct methods or other syntax issues
    if code.count('def construct(self):') > 1:
        logger.info("Detected duplicate construct methods, trying to fix...")
        # Try to keep only the first construct method
        parts = code.split('def construct(self):')
        if len(parts) > 1:
            code = parts[0] + 'def construct(self):' + parts[1]
            logger.info("Fixed duplicate construct methods")
        else:
            logger.info("Could not fix duplicate construct methods, using fallback")
            return create_animation_with_content(extract_text_content(original_code))
    
    # Lines with potential animation commands
    animation_lines = []
    
    # Scan for animation commands
    for line in code.split('\n'):
        if 'self.play(' in line or 'self.wait(' in line or 'self.add(' in line:
            animation_lines.append(line)
    
    # If we don't have animation commands, add some basic ones but keep the rest of the code
    if not animation_lines:
        logger.info("No animation commands found, adding basic animation commands")
        
        # Try to find the construct method and add animation commands there
        if 'def construct(self):' in code:
            construct_parts = code.split('def construct(self):')
            code = construct_parts[0] + 'def construct(self):' + """
        # Added basic animation commands
        text = Text("Animation", font_size=36)
        text.move_to(ORIGIN)
        self.play(Write(text))
        self.wait(1)
        
""" + construct_parts[1]
            logger.info("Added basic animation commands to the existing code")
        else:
            # If we can't find where to add animations, extract content and use template
            text_content = extract_text_content(original_code)
            logger.info(f"Could not find where to add animation commands, using template with content: {text_content}")
            return create_animation_with_content(text_content)
    
    # Add necessary imports and color definitions if they're missing
    if 'import manim' in code or 'from manim import' in code:
        # Has imports already
        pass
    else:
        code = """from manim import *

""" + code
        logger.info("Added manim import")
    
    # Make sure there's a __main__ guard
    if "__name__" not in code and "if __name__" not in code:
        # Extract scene class name
        scene_class = None
        for line in code.split('\n'):
            if 'class' in line and 'Scene' in line:
                try:
                    scene_class = line.split('class')[1].split('(')[0].strip()
                    break
                except:
                    pass
        
        if scene_class:
            code += f"""

# Main execution guard
if __name__ == '__main__':
    {scene_class}().render()
"""
            logger.info(f"Added main guard with scene class {scene_class}")
    
    logger.info("Returning fixed code")
    return code

def extract_text_content(code):
    """Extract text content from code for use in animations."""
    # Try to find any content in string literals
    text_content = None
    for line in code.split('\n'):
        if '"' in line or "'" in line:
            # Try to find content within quotes
            start = line.find('"') if '"' in line else line.find("'")
            end = line.rfind('"') if '"' in line else line.rfind("'")
            if start != -1 and end != -1 and end > start:
                potential_text = line[start+1:end].strip()
                # Only use reasonably sized text content
                if len(potential_text) > 5 and len(potential_text) < 200:
                    text_content = potential_text
                    break
    
    return text_content

def create_basic_animation_template():
    """Create a reliable basic animation template."""
    return """from manim import *

class BasicScene(Scene):
    def construct(self):
        # Create a simple text animation
        title = Text("Animation Demo", font_size=36)
        title.move_to(ORIGIN)
        
        # Create animation sequence
        self.play(Write(title))
        self.wait(1)
        
        # Move title up and add subtitle
        self.play(title.animate.scale(0.8).to_edge(UP))
        
        subtitle = Text("Created with Manim", font_size=24)
        subtitle.move_to(ORIGIN)
        
        self.play(FadeIn(subtitle))
        self.wait(1)
        
        # Add a shape with animation
        shape = Square(side_length=3)
        shape.move_to(ORIGIN + DOWN)
        shape.set_stroke(BLUE)
        
        self.play(Create(shape))
        self.wait(1)
        
        # Add some visual interest
        self.play(
            shape.animate.set_fill(BLUE, opacity=0.5)
        )
        self.wait(2)

# Main execution guard
if __name__ == '__main__':
    BasicScene().render()
"""

def create_animation_with_content(text_content=None):
    """Create a new animation with specified content if available."""
    # Use default text if none was extracted
    if not text_content:
        text_content = "Generated Animation"
    
    # Make text safe for f-string interpolation
    text_content = text_content.replace('{', '{{').replace('}', '}}')
    
    # Use random colors instead of hardcoded RED
    colors = [
        'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE', 'TEAL', 'GOLD', 'MAROON'
    ]
    random_color1 = colors[hash(text_content) % len(colors)]
    random_color2 = colors[(hash(text_content) + 3) % len(colors)]
    
    # Choose a random animation style based on content hash
    animation_style = hash(text_content) % 3
    
    if animation_style == 0:
        # Text with circle animation
        return f"""from manim import *

class ContentScene(Scene):
    def construct(self):
        # Create title
        title = Text("{text_content}", font_size=36)
        title.scale_to_fit_width(config.frame_width - 2)
        title.move_to(ORIGIN)
        
        # Create animation sequence
        self.play(Write(title))
        self.wait(1)
        
        # Move title up
        self.play(title.animate.scale(0.8).to_edge(UP, buff=1))
        
        # Create some visual elements
        elements = VGroup()
        circle = Circle(radius=2, color={random_color1})
        elements.add(circle)
        
        # Add the elements with a nice animation
        self.play(Create(elements))
        self.wait(1)
        
        # Add some color transition
        self.play(
            circle.animate.set_fill({random_color2}, opacity=0.5)
        )
        self.wait(2)

# Main execution guard
if __name__ == '__main__':
    ContentScene().render()
"""
    elif animation_style == 1:
        # Text with rectangle and formula
        return f"""from manim import *

class ContentScene(Scene):
    def construct(self):
        # Create the main content
        title = Text("{text_content}", font_size=32)
        title.scale_to_fit_width(config.frame_width - 2)
        title.move_to(ORIGIN)
        
        # Create animation sequence
        self.play(Write(title))
        self.wait(1)
        
        # Move title up
        self.play(title.animate.scale(0.7).to_edge(UP, buff=1))
        
        # Add a rectangle with text
        rect = Rectangle(height=3, width=5, color={random_color1})
        rect.move_to(ORIGIN)
        
        subtitle = Text("Visual Explanation", font_size=24)
        subtitle.next_to(rect, DOWN, buff=0.5)
        
        self.play(Create(rect), Write(subtitle))
        self.wait(1)
        
        # Add some color
        self.play(
            rect.animate.set_fill({random_color2}, opacity=0.3)
        )
        self.wait(2)

# Main execution guard
if __name__ == '__main__':
    ContentScene().render()
"""
    else:
        # Text with arrow diagram
        return f"""from manim import *

class ContentScene(Scene):
    def construct(self):
        # Create the main content
        title = Text("{text_content}", font_size=32)
        title.scale_to_fit_width(config.frame_width - 2)
        title.move_to(ORIGIN)
        
        # Create animation sequence
        self.play(Write(title))
        self.wait(1)
        
        # Move title up
        self.play(title.animate.scale(0.7).to_edge(UP, buff=1))
        
        # Create a simple diagram with arrows
        start_point = Text("Start", font_size=24, color={random_color1})
        start_point.shift(LEFT * 3)
        
        end_point = Text("End", font_size=24, color={random_color2})
        end_point.shift(RIGHT * 3)
        
        arrow = Arrow(start_point.get_right(), end_point.get_left(), color=WHITE)
        
        # Animate the diagram
        self.play(Write(start_point))
        self.wait(0.5)
        self.play(Create(arrow))
        self.wait(0.5)
        self.play(Write(end_point))
        self.wait(2)

# Main execution guard
if __name__ == '__main__':
    ContentScene().render()
"""

def upload_to_supabase_storage(file_path=None, bucket_name="animations", object_name=None, content_type="video/mp4", file_content=None):
    """
    Upload a file to Supabase Storage
    
    Args:
        file_path: Local path to the file (optional if file_content is provided)
        bucket_name: Name of the Supabase Storage bucket
        object_name: Name to use for the file in the bucket
        content_type: MIME type of the content
        file_content: The content to upload (optional if file_path is provided)
        
    Returns:
        The URL to the uploaded file, or None if upload failed
    """
    if not supabase:
        logger.error("Supabase client not initialized")
        return None
    
    if not file_path and not file_content:
        logger.error("Either file_path or file_content must be provided")
        return None
    
    try:
        if file_path:
            # Use the Supabase Python client for file upload
            with open(file_path, 'rb') as f:
                file_data = f.read()
                supabase.storage.from_(bucket_name).upload(object_name, file_data)
        else:
            # Upload from content
            if isinstance(file_content, str):
                file_data = file_content.encode('utf-8')
            else:
                file_data = file_content
            supabase.storage.from_(bucket_name).upload(object_name, file_data)
        
        # Return the public URL
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{bucket_name}/{object_name}"
        logger.info(f"Successfully uploaded to Supabase Storage: {public_url}")
        return public_url
    except Exception as e:
        logger.error(f"Exception uploading to Supabase Storage: {str(e)}")
        return None

def execute_manim_code(code, message_id, step=1):
    """
    Execute Manim code and return the URL to the generated animation.
    
    Args:
        code (str): The Manim code to execute
        message_id (str): A unique ID for the message/request
        step (int): The step number for multi-step animations (default: 1)
        
    Returns:
        str: URL to the generated animation
    """
    # Add a helper function to fix Manim commands
    def fix_manim_command(cmd_to_fix):
        """Fix any Manim command to use modern syntax."""
        if isinstance(cmd_to_fix, list):
            # If it's a list, try to fix each element
            if "--verbose" in cmd_to_fix:
                # Replace --verbose with --verbosity DEBUG
                cmd_fixed = []
                skip_next = False
                for i, item in enumerate(cmd_to_fix):
                    if skip_next:
                        skip_next = False
                        continue
                    if item == "--verbose":
                        cmd_fixed.append("--verbosity")
                        cmd_fixed.append("DEBUG")
                        continue
                    cmd_fixed.append(item)
                return cmd_fixed
            # Make sure 'render' is included after 'manim'
            if "-m" in cmd_to_fix and "manim" in cmd_to_fix:
                manim_index = cmd_to_fix.index("manim")
                if manim_index + 1 < len(cmd_to_fix) and cmd_to_fix[manim_index + 1] != "render":
                    # Insert 'render' after 'manim'
                    cmd_fixed = cmd_to_fix.copy()
                    cmd_fixed.insert(manim_index + 1, "render")
                    return cmd_fixed
        return cmd_to_fix  # Return original if no fixes needed
    
    # Start of the main function logic
    logger.info(f"Starting execute_manim_code for message_id={message_id}, step={step}")
    
    # Check if Manim is working before attempting to run
    if not MANIM_WORKING:
        logger.error("Manim is not working properly on this system. Using placeholder animation.")
        service_url = os.environ.get("MANIM_SERVICE_URL", "https://manim-service-589284378993.us-central1.run.app")
        return f"{service_url}/placeholder-animation.mp4"
    
    try:
        # Generate a hash of the code for caching
        code_hash = hashlib.md5(code.encode()).hexdigest()
        
        # Check if we have a cached result
        cached_url = check_cache(code_hash)
        if cached_url:
            logger.info(f"Returning cached animation for {message_id} with hash {code_hash}")
            return cached_url
        
        # Fix common issues in the Manim code
        code = fix_manim_code(code)
        
        # Upload the code to Supabase Storage
        code_filename = f"{message_id}_{code_hash}.py"
        supabase_code_url = upload_to_supabase_storage(
            file_path=None,
            file_content=code,
            bucket_name="manim-code",
            object_name=code_filename,
            content_type="text/plain"
        )
        
        if supabase_code_url:
            logger.info(f"Successfully uploaded code to Supabase Storage: {supabase_code_url}")
        
        # Create a temporary directory for the code
        with tempfile.TemporaryDirectory() as tempdir:
            logger.info(f"Created temporary directory at {tempdir}")
            
            # Save the code to a temporary file
            code_file = os.path.join(tempdir, "animation.py")
            with open(code_file, "w") as f:
                f.write(code)
            
            logger.info(f"Code to be executed for {message_id}:\n{code}")
            
            # Validate the syntax
            logger.info(f"Validating syntax for {message_id}")
            try:
                py_compile.compile(code_file, doraise=True)
            except py_compile.PyCompileError as e:
                logger.error(f"Syntax error in code: {e}")
                service_url = os.environ.get("MANIM_SERVICE_URL", "https://manim-service-589284378993.us-central1.run.app")
                return f"{service_url}/placeholder-animation.mp4"
            
            # Extract the scene class from the code
            scene_class = None
            for line in code.split("\n"):
                if "class" in line and "Scene" in line:
                    scene_class = line.split("class")[1].split("(")[0].strip()
                    break
            
            if not scene_class:
                logger.error(f"No Scene class found in code for {message_id}")
                service_url = os.environ.get("MANIM_SERVICE_URL", "https://manim-service-589284378993.us-central1.run.app")
                return f"{service_url}/placeholder-animation.mp4"
            
            logger.info(f"Found scene class: {scene_class}")
            
            # Create the expected output directory structure
            os.makedirs(os.path.join(tempdir, "videos"), exist_ok=True)
            
            # Create a default config file
            with open(os.path.join(tempdir, "manim.cfg"), "w") as config_file:
                config_file.write("""
[CLI]
media_dir = {tempdir}
video_dir = {video_dir}
""".format(tempdir=tempdir, video_dir=os.path.join(tempdir, "videos")))
            
            # Run Manim with the extracted scene class
            cmd_list = [
                "python3", "-m", "manim", "render", code_file, scene_class,
                "-qm",  # Medium quality for faster rendering
                "--media_dir", tempdir,
                "--config_file", os.path.join(tempdir, "manim.cfg"),
                "--verbosity", "DEBUG",  # Use verbosity instead of verbose
                "--progress_bar", "none"  # Disable progress bar for cleaner logs
            ]
            
            # Make sure the command is using the correct flags
            cmd_list = fix_manim_command(cmd_list)
            
            logger.info(f"Running command: {' '.join(cmd_list)}")
            try:
                # Get both stdout and stderr for debugging
                result = subprocess.run(
                    cmd_list,
                    check=True,
                    timeout=120,  # 2 minute timeout
                    cwd=tempdir,
                    capture_output=True,
                    text=True
                )
                logger.info("Manim execution completed successfully")
                logger.info(f"Manim stdout: {result.stdout[:500]}...")
                if result.stderr:
                    logger.info(f"Manim stderr: {result.stderr[:500]}...")
            except subprocess.TimeoutExpired as e:
                logger.error(f"Manim execution timed out after 120 seconds")
                if hasattr(e, 'stdout') and e.stdout:
                    logger.error(f"Timeout stdout: {e.stdout[:500]}...")
                if hasattr(e, 'stderr') and e.stderr:
                    logger.error(f"Timeout stderr: {e.stderr[:500]}...")
                service_url = os.environ.get("MANIM_SERVICE_URL", "https://manim-service-589284378993.us-central1.run.app")
                return f"{service_url}/placeholder-animation.mp4"
            except subprocess.CalledProcessError as e:
                logger.error(f"Manim execution failed with return code {e.returncode}")
                if e.stdout:
                    logger.error(f"Error stdout: {e.stdout[:500]}...")
                if e.stderr:
                    logger.error(f"Error stderr: {e.stderr[:500]}...")
                service_url = os.environ.get("MANIM_SERVICE_URL", "https://manim-service-589284378993.us-central1.run.app")
                return f"{service_url}/placeholder-animation.mp4"
            
            # Search for the generated MP4 file in different locations
            # Possible locations for the MP4 file
            possible_locations = [
                os.path.join(tempdir, "videos", f"{scene_class}.mp4"),
                os.path.join(tempdir, "videos", "animation", scene_class, f"{scene_class}.mp4"),
                # Add more potential locations as needed
            ]
            
            # Also search in partial_movie_files
            partial_dir = os.path.join(tempdir, "videos", "partial_movie_files", scene_class)
            if os.path.exists(partial_dir):
                mp4_files = [f for f in os.listdir(partial_dir) if f.endswith(".mp4")]
                if mp4_files:
                    possible_locations.append(os.path.join(partial_dir, mp4_files[0]))
            
            # First, list all the files in the temp directory for debugging
            logger.info("Listing all files in the output directory structure:")
            for root, dirs, files in os.walk(tempdir):
                if files:  # Only log directories that contain files
                    relative_path = os.path.relpath(root, tempdir)
                    logger.info(f"Files in {relative_path}: {', '.join(files)}")
            
            # Try all possible locations
            found_mp4 = None
            for location in possible_locations:
                if os.path.exists(location):
                    found_mp4 = location
                    logger.info(f"Found MP4 file at: {found_mp4}")
                    logger.info(f"File size: {os.path.getsize(found_mp4)} bytes")
                    break
            
            # Last resort: Search for ANY MP4 file in the entire temp directory
            if not found_mp4:
                logger.info("Searching for any MP4 files in the entire temp directory")
                mp4_files = []
                for root, dirs, files in os.walk(tempdir):
                    for file in files:
                        if file.endswith(".mp4"):
                            file_path = os.path.join(root, file)
                            file_size = os.path.getsize(file_path)
                            mp4_files.append((file_path, file_size))
                            logger.info(f"Found MP4: {file_path}, size: {file_size} bytes")
                
                if mp4_files:
                    # Sort by file size (largest first) AND creation time (newest first)
                    # This prioritizes actual animations over thumbnails or other small MP4 files
                    mp4_files.sort(key=lambda x: (x[1], os.path.getmtime(x[0])), reverse=True)
                    found_mp4 = mp4_files[0][0]
                    logger.info(f"Selected MP4 file: {found_mp4}, size: {mp4_files[0][1]} bytes")
            
            if not found_mp4:
                logger.error("No MP4 files found anywhere in the temp directory")
                service_url = os.environ.get("MANIM_SERVICE_URL", "https://manim-service-589284378993.us-central1.run.app")
                return f"{service_url}/placeholder-animation.mp4"
            
            # Generate a unique filename that includes the step number
            output_filename = f"{message_id}_step{step}_{code_hash}.mp4"
            
            # Try to upload to Supabase Storage first
            supabase_url = upload_to_supabase_storage(
                file_path=found_mp4, 
                bucket_name="animations",
                object_name=output_filename
            )
            
            if supabase_url:
                # Store in cache
                store_in_cache(code, code_hash, supabase_url)
                logger.info(f"Returning Supabase Storage URL: {supabase_url}")
                return supabase_url
            
            # Fallback to local storage if Supabase upload fails
            logger.warning("Supabase upload failed, falling back to local storage")
            
            # Copy to our media directory
            output_dir = os.path.join(MEDIA_DIR, "videos")
            os.makedirs(output_dir, exist_ok=True)
            
            output_path = os.path.join(output_dir, output_filename)
            
            logger.info(f"Copying {found_mp4} to {output_path}")
            shutil.copy2(found_mp4, output_path)
            
            # Create the URL with absolute path to ensure it works across domains
            service_url = os.environ.get("MANIM_SERVICE_URL", "https://manim-service-589284378993.us-central1.run.app")
            video_url = f"{service_url}/media/videos/{output_filename}"
            
            # Store in cache
            store_in_cache(code, code_hash, video_url)
            
            logger.info(f"Returning absolute video URL: {video_url}")
            return video_url
            
    except Exception as e:
        logger.error(f"Error executing Manim: {e}", exc_info=True)
        service_url = os.environ.get("MANIM_SERVICE_URL", "https://manim-service-589284378993.us-central1.run.app")
        return f"{service_url}/placeholder-animation.mp4"

@app.route("/execute-manim", methods=["POST"])
@handle_exceptions
def execute_manim():
    """Execute Manim code and return video URL"""
    data = request.json
    
    if not data or "code" not in data:
        response = jsonify({"success": False, "error": "Missing 'code' in request"}), 400
        return add_cors_headers(response)
    
    code = data["code"]
    message_id = data.get("message_id") or data.get("messageId", str(uuid.uuid4()))
    step = data.get("step", 1)  # Optional step parameter for multi-step animations
    
    logger.info(f"Executing Manim code for message {message_id}, step {step}")
    
    # Prepend step information to message_id for clarity
    step_message_id = f"{message_id}_step{step}"
    logger.info(f"Using step-specific message ID: {step_message_id}")
    
    # Execute the code and get the video URL
    video_url = execute_manim_code(code, step_message_id, step)
    
    # Prepare a standardized response format for animation data
    animation_data = [{"step": step, "url": video_url}]
    logger.info(f"Response animation_data: {animation_data}")
    
    # If a Supabase client is available, update the database
    if supabase:
        try:
            # Convert message_id to string to ensure string operations work
            message_id = str(message_id)
            
            # Extract base message ID (without step) for database operations
            base_message_id = message_id.split('_step')[0] if '_step' in message_id else message_id
            
            # Check if the message_id is a valid UUID 
            is_uuid = False
            try:
                uuid_obj = uuid.UUID(base_message_id)
                is_uuid = True
                logger.info(f"Message ID is a valid UUID: {base_message_id}")
            except ValueError:
                is_uuid = False
                logger.info(f"Message ID is not a UUID: {base_message_id}")
            
            # First try lookup by session_id if the message_id is a UUID
            message_id_for_db = None
            if is_uuid:
                try:
                    lookup_result = supabase.table("chat_messages").select("id").eq("session_id", base_message_id).execute()
                    
                    if lookup_result.data and len(lookup_result.data) > 0:
                        # Use the numeric ID from the lookup
                        message_id_for_db = lookup_result.data[0]['id']
                        logger.info(f"Found numeric ID {message_id_for_db} for message with session_id {base_message_id}")
                    else:
                        logger.warning(f"No records found with session_id={base_message_id}")
                except Exception as lookup_error:
                    logger.error(f"Error looking up message ID by session_id: {lookup_error}")
            
            # If we don't have a valid ID yet, try direct conversion
            if message_id_for_db is None:
                # Check if the message ID is numeric (for existing database entries)
                # or use it as is for new formats (UUIDs or custom IDs)
                if base_message_id.isdigit():
                    message_id_for_db = int(base_message_id)
                    logger.info(f"Using numeric message ID: {message_id_for_db}")
                else:
                    message_id_for_db = base_message_id
                    logger.warning(f"Using non-numeric message ID: {message_id_for_db}")
            
            try:
                # Get existing animation_url data
                existing_data_result = supabase.table("chat_messages").select("animation_url").eq("id", message_id_for_db).execute()
                
                existing_data = existing_data_result.data[0]["animation_url"] if existing_data_result.data else []
                logger.info(f"Existing animation_url data: {existing_data}")
                
                # Merge with new data if possible
                if isinstance(existing_data, list):
                    # Check if step already exists
                    step_exists = False
                    for item in existing_data:
                        if item.get("step") == step:
                            item["url"] = video_url
                            step_exists = True
                            logger.info(f"Updated existing step {step} with URL {video_url}")
                            break
                    
                    if not step_exists:
                        existing_data.append({"step": step, "url": video_url})
                        logger.info(f"Added new step {step} with URL {video_url}")
                    
                    merged_data = existing_data
                else:
                    merged_data = [{"step": step, "url": video_url}]
                    logger.info(f"Created new animation_url array with step {step}")
                
                # Sort the array by step number to ensure correct order
                merged_data.sort(key=lambda x: x.get("step", 0))
                
                logger.info(f"Final merged animation_url data: {merged_data}")
                
                # Update with merged data
                update_result = supabase.table("chat_messages").update({
                    "animation_url": merged_data,
                    "animation_status": "completed"
                }).eq("id", message_id_for_db).execute()
                
                logger.info(f"Database update result: {update_result}")
                
                logger.info(f"Updated chat_messages for message {message_id_for_db}")
                
            except Exception as e:
                logger.error(f"Error updating chat_messages: {e}")
                
                # Fallback - try updating with just the status
                try:
                    supabase.table("chat_messages").update({
                        "animation_status": "completed"
                    }).eq("id", message_id_for_db).execute()
                    logger.info(f"Updated just animation_status for message {message_id_for_db}")
                except Exception as status_error:
                    logger.error(f"Even simple status update failed: {status_error}")
        
        except Exception as e:
            logger.error(f"Error with Supabase client: {e}")
    
    # Return response
    response = jsonify({
        "success": True,
        "url": video_url,
        "animation_data": animation_data
    })
    return add_cors_headers(response)

@app.route("/check-animation-status/<message_id>", methods=["GET", "OPTIONS"])
@handle_exceptions
def check_animation_status(message_id):
    """Check if animation is ready for a message ID"""
    if request.method == "OPTIONS":
        response = jsonify({})
        return add_cors_headers(response)
    
    try:
        # Extract the base message ID (removing any step information)
        base_message_id = message_id.split('_step')[0]
        
        # Look for animation files for this message
        animations = []
        for filename in os.listdir(MEDIA_DIR):
            if filename.startswith(f"{base_message_id}_") and filename.endswith(".mp4"):
                # Extract step number if present
                step_match = re.search(r'_step(\d+)\.mp4$', filename)
                step = int(step_match.group(1)) if step_match else 1
                
                service_url = os.environ.get("MANIM_SERVICE_URL", "https://manim-service-589284378993.us-central1.run.app")
                animations.append({
                    "step": step,
                    "url": f"{service_url}/media/{filename}"
                })
        
        # Sort animations by step
        animations.sort(key=lambda x: x["step"])
        
        response = jsonify({
            "success": True,
            "message_id": base_message_id,
            "animations": animations,
            "status": "completed" if animations else "pending"
        })
        
        return add_cors_headers(response)
    except Exception as e:
        logger.error(f"Error checking animation status: {e}", exc_info=True)
        response = jsonify({
            "success": False,
            "error": str(e)
        })
        return add_cors_headers(response)

# Register the CORS headers function for all responses
@app.after_request
def after_request(response):
    return add_cors_headers(response)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    logger.info(f"Starting Flask application on port {port}")
    app.run(host="0.0.0.0", port=port, debug=False)