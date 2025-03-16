#!/usr/bin/env python3
import os
import subprocess
import tempfile
import dotenv
import supabase
import sys
import re

# Load environment variables
dotenv.load_dotenv()

# Supabase configuration
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
STORAGE_BUCKET = "test-gemini-animations"
FILE_NAME = "gemini_1.mp4"

# Initialize Supabase client
supabase_client = supabase.create_client(SUPABASE_URL, SUPABASE_KEY)

def fix_manim_code(file_path):
    """Fix common issues in Manim code."""
    with open(file_path, 'r') as f:
        code = f.read()
    
    print("Applying fixes to the Manim code...")
    
    # Make a copy of the original code for comparison
    original_code = code
    
    # Fix 1: Replace self.section() method which doesn't exist
    fixed_code = re.sub(
        r'self\.section\(([^)]+)\)', 
        r'# Section: \1\n        # self.section() was removed as it\'s not available in this Manim version', 
        code
    )
    
    # Fix 2: Fix Tex color handling - move color from constructor to set_color method
    fixed_code = re.sub(
        r'Tex\((.*?),\s*color=([^,\)]+)(.*?)\)',
        r'Tex(\1\3).set_color(\2)',
        fixed_code
    )
    
    # Fix 3: Fix MathTex color handling similarly
    fixed_code = re.sub(
        r'MathTex\((.*?),\s*color=([^,\)]+)(.*?)\)',
        r'MathTex(\1\3).set_color(\2)',
        fixed_code
    )
    
    # Fix 4: Replace get_edge(LEFT) with get_left() and get_edge(RIGHT) with get_right()
    fixed_code = re.sub(
        r'\.get_edge\s*\(\s*LEFT\s*\)',
        r'.get_left()',
        fixed_code
    )
    
    fixed_code = re.sub(
        r'\.get_edge\s*\(\s*RIGHT\s*\)',
        r'.get_right()',
        fixed_code
    )
    
    fixed_code = re.sub(
        r'\.get_edge\s*\(\s*UP\s*\)',
        r'.get_top()',
        fixed_code
    )
    
    fixed_code = re.sub(
        r'\.get_edge\s*\(\s*DOWN\s*\)',
        r'.get_bottom()',
        fixed_code
    )
    
    # Fix 5: Convert problematic Indicate calls to a safer format
    # Use a more comprehensive approach for all VGroup slice patterns
    def fix_indicate_with_slice(code):
        lines = code.split('\n')
        fixed_lines = []
        
        for line in lines:
            if 'Indicate(' in line and '[' in line and ':' in line and ']' in line:
                # Parse the line to safely extract the VGroup name and slice information
                pattern = r'Indicate\((\w+)\[(\d+):(\d+)(?::(\d+))?\](,\s*color=([^,\)]+))?\)'
                matches = list(re.finditer(pattern, line))
                
                if matches:
                    for match in matches:
                        vgroup_name = match.group(1)
                        start = match.group(2)
                        end = match.group(3)
                        step = match.group(4) if match.group(4) else "1"
                        color_part = match.group(5) if match.group(5) else ""
                        
                        # Create a VGroup from individual elements
                        if step == "1":
                            if int(end) - int(start) <= 1:
                                replacement = f"Indicate({vgroup_name}[{start}]{color_part})"
                            else:
                                elements = ", ".join([f"{vgroup_name}[{i}]" for i in range(int(start), int(end))])
                                replacement = f"Indicate(VGroup({elements}){color_part})"
                        else:
                            elements = ", ".join([f"{vgroup_name}[{i}]" for i in range(int(start), int(end), int(step))])
                            replacement = f"Indicate(VGroup({elements}){color_part})"
                        
                        line = line.replace(match.group(0), replacement)
                
                # Also handle cases where we're trying to indicate an entire list/array
                if any(pattern in line for pattern in ['Indicate(input_layer_nodes', 'Indicate(hidden_layer_nodes', 'Indicate(output_layer_nodes']):
                    for obj_name in ['input_layer_nodes', 'hidden_layer_nodes', 'output_layer_nodes']:
                        if f'Indicate({obj_name}' in line and f'VGroup(*{obj_name})' not in line:
                            line = line.replace(f'Indicate({obj_name}', f'Indicate(VGroup(*{obj_name})')
            
            fixed_lines.append(line)
        
        return '\n'.join(fixed_lines)
    
    fixed_code = fix_indicate_with_slice(fixed_code)
    
    # Fix 6: Fix LaTeX special characters (specifically ampersands)
    # Simple direct approach to fix the most common issue
    def fix_ampersands_in_tex(code):
        # Find Tex calls with ampersands
        pattern = r'Tex\("([^"]*?)&([^"]*?)"\)'
        fixed_code = re.sub(pattern, r'Tex("\1\\&\2")', code)
        
        # Also check for r-strings
        pattern = r'Tex\(r"([^"]*?)&([^"]*?)"\)'
        fixed_code = re.sub(pattern, r'Tex(r"\1\\&\2")', fixed_code)
        
        return fixed_code
    
    fixed_code = fix_ampersands_in_tex(fixed_code)
    
    # Check if we made any changes
    if fixed_code != original_code:
        print("Applied several fixes to the Manim code.")
    else:
        print("No fixes were needed or applied.")
    
    # Create a temporary file with the fixed code
    with tempfile.NamedTemporaryFile(suffix='.py', mode='w', delete=False) as temp_file:
        temp_filename = temp_file.name
        temp_file.write(fixed_code)
    
    return temp_filename

def render_and_upload(file_path):
    """Fix, render, and upload a Manim animation to Supabase."""
    # Fix the code
    fixed_file = fix_manim_code(file_path)
    print(f"Created fixed version at: {fixed_file}")
    
    # Extract the Scene class name
    scene_name = None
    with open(fixed_file, 'r') as f:
        content = f.read()
        for line in content.split('\n'):
            if line.strip().startswith('class ') and '(Scene)' in line:
                scene_name = line.split('class ')[1].split('(')[0].strip()
                break
    
    if not scene_name:
        print("Error: Could not find a Scene class in the code")
        os.unlink(fixed_file)
        return False
    
    print(f"Found scene class: {scene_name}")
    
    # Create a temporary directory for output
    with tempfile.TemporaryDirectory() as output_dir:
        # Run manim
        cmd = f"manim {fixed_file} {scene_name} -qm --format=mp4 -o gemini_render"
        print(f"Running: {cmd}")
        
        # Change to the output directory
        original_dir = os.getcwd()
        os.chdir(output_dir)
        
        try:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            
            if result.returncode != 0:
                print(f"Error rendering animation:")
                print(result.stderr)
                
                # If there's a LaTeX error, try to extract the log file for more info
                log_files = []
                for root, _, files in os.walk('.'):
                    for file in files:
                        if file.endswith('.log'):
                            log_files.append(os.path.join(root, file))
                
                if log_files:
                    print("\nLaTeX error log files found:")
                    for log_file in log_files[:3]:  # Show up to 3 log files
                        print(f"Log file: {log_file}")
                        try:
                            with open(log_file, 'r') as f:
                                log_content = f.read().strip()
                                # Extract a relevant portion of the log
                                lines = log_content.split('\n')
                                error_lines = [line for line in lines if "Error" in line or "error" in line]
                                if error_lines:
                                    print("Error details:")
                                    for line in error_lines[-5:]:  # Show last 5 error lines
                                        print(f"  {line}")
                                    print()
                        except Exception as e:
                            print(f"Could not read log file: {e}")
                
                # If there's a SyntaxError, show the fixed file content
                if "SyntaxError" in result.stderr:
                    print("\nSyntax Error in the generated code. Here's the problematic section:")
                    try:
                        with open(fixed_file, 'r') as f:
                            file_content = f.read()
                            # Try to find the line number from the error message
                            error_line_match = re.search(r'line (\d+)', result.stderr)
                            if error_line_match:
                                error_line = int(error_line_match.group(1))
                                lines = file_content.split('\n')
                                # Show a few lines before and after the error
                                start_line = max(0, error_line - 5)
                                end_line = min(len(lines), error_line + 5)
                                for i in range(start_line, end_line):
                                    prefix = ">>> " if i == error_line - 1 else "    "
                                    print(f"{prefix}Line {i+1}: {lines[i]}")
                    except Exception as e:
                        print(f"Could not read fixed file: {e}")
                
                os.chdir(original_dir)
                os.unlink(fixed_file)
                return False
            
            # Find the rendered MP4 file
            mp4_file = None
            for root, _, files in os.walk('.'):
                for file in files:
                    if file.endswith('.mp4'):
                        mp4_file = os.path.join(root, file)
                        break
                if mp4_file:
                    break
            
            if not mp4_file:
                print("Error: Could not find rendered MP4 file")
                os.chdir(original_dir)
                os.unlink(fixed_file)
                return False
            
            # Upload to Supabase
            with open(mp4_file, 'rb') as f:
                file_data = f.read()
            
            print(f"Uploading to Supabase as {FILE_NAME}...")
            
            # Check if bucket exists
            try:
                buckets = supabase_client.storage.list_buckets()
                bucket_exists = False
                
                # Check bucket existence properly
                for bucket in buckets:
                    if isinstance(bucket, dict) and bucket.get('name') == STORAGE_BUCKET:
                        bucket_exists = True
                        break
                
                if not bucket_exists:
                    print(f"Creating bucket '{STORAGE_BUCKET}'...")
                    supabase_client.storage.create_bucket(STORAGE_BUCKET)
            except Exception as e:
                print(f"Error checking/creating bucket: {e}")
                # Continue anyway since the bucket might already exist
            
            # Upload file
            try:
                # Fix the upload parameters to ensure proper headers
                supabase_client.storage.from_(STORAGE_BUCKET).upload(
                    path=FILE_NAME,
                    file=file_data,
                    file_options={"contentType": "video/mp4", "upsert": "true"}
                )
                
                # Get the public URL
                url = supabase_client.storage.from_(STORAGE_BUCKET).get_public_url(FILE_NAME)
                print(f"Upload successful! File available at: {url}")
            except Exception as e:
                print(f"Upload error: {e}")
                # Print more details to help debug
                print("Trying to get more error details...")
                try:
                    print(f"Bucket exists check: {supabase_client.storage.from_(STORAGE_BUCKET) is not None}")
                except Exception as inner_e:
                    print(f"Error checking bucket: {inner_e}")
            
            # Return to the original directory
            os.chdir(original_dir)
            os.unlink(fixed_file)
            return True
            
        except Exception as e:
            print(f"Error: {e}")
            os.chdir(original_dir)
            os.unlink(fixed_file)
            return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        print(f"Fixing, rendering, and uploading Manim file: {file_path}")
        render_and_upload(file_path)
    else:
        print("Error: Please provide the path to a Manim script")
        print("Usage: python fix_and_upload_gemini.py your_manim_script.py") 