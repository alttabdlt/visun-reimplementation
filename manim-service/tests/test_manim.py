#!/usr/bin/env python3
"""
Quick testing script for Manim code without deploying
Usage: python test_manim.py <scene_name>

This script will test a Manim scene locally without requiring a full rebuild and
deployment to Google Cloud Run.
"""

import os
import sys
import subprocess
import tempfile
import shutil

def test_manim_locally(scene_name="ContentScene"):
    """
    Test a Manim scene locally.
    
    Args:
        scene_name (str): The name of the scene class to test
    """
    # Sample test code - replace with your own test code
    test_code = f"""
from manim import *

# Common color definitions
RED = "#FF0000"
GREEN = "#00FF00"
BLUE = "#0000FF"
YELLOW = "#FFFF00"
PURPLE = "#800080"
ORANGE = "#FFA500"
WHITE = "#FFFFFF"
BLACK = "#000000"

class {scene_name}(Scene):
    def construct(self):
        # Create text
        text = Text(
            "Test Animation",
            font_size=36
        ).scale_to_fit_width(config.frame_width - 2)
        
        text.move_to(ORIGIN)
        
        # Create a simple animation sequence
        self.play(Write(text))
        self.wait(1)
        
        # Add a decorative element
        circle = Circle(radius=3.5)
        circle.set_stroke(BLUE_E, opacity=0.5)
        self.play(Create(circle))
        
        # More animation
        self.play(
            text.animate.scale(0.8).to_edge(UP, buff=1),
            circle.animate.scale(0.8)
        )
        self.wait(2)

# Main execution guard
if __name__ == '__main__':
    {scene_name}().render()
"""

    # Create a temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            # Save the code to a temporary file
            code_file = os.path.join(temp_dir, "test_animation.py")
            with open(code_file, "w") as f:
                f.write(test_code)
            
            print(f"Created temporary file: {code_file}")
            print(f"Testing scene: {scene_name}")
            
            # Create a default config file
            config_file = os.path.join(temp_dir, "manim.cfg")
            with open(config_file, "w") as f:
                f.write(f"""
[CLI]
media_dir = {temp_dir}
video_dir = {os.path.join(temp_dir, "videos")}
""")
            
            # Create the output directory
            videos_dir = os.path.join(temp_dir, "videos")
            os.makedirs(videos_dir, exist_ok=True)
            
            # Run Manim
            cmd_list = [
                "python3", "-m", "manim", "render", code_file, scene_name,
                "-qm",  # Medium quality for faster rendering
                "--media_dir", temp_dir,
                "--config_file", config_file,
                "--verbosity", "DEBUG"  # Use verbosity instead of verbose
            ]
            
            print(f"Running command: {' '.join(cmd_list)}")
            
            result = subprocess.run(
                cmd_list,
                check=True,
                cwd=temp_dir,
                capture_output=False  # Show output directly
            )
            
            # Find the output file
            output_file = os.path.join(videos_dir, f"{scene_name}.mp4")
            if os.path.exists(output_file):
                # Copy to current directory for easy access
                local_output = f"./{scene_name}_output.mp4"
                shutil.copy(output_file, local_output)
                print(f"\nSuccess! Output copied to {local_output}")
            else:
                print(f"\nOutput file not found at expected location: {output_file}")
                # Look for files in the videos directory
                print("Files in videos directory:")
                for root, dirs, files in os.walk(videos_dir):
                    for file in files:
                        if file.endswith(".mp4"):
                            src_file = os.path.join(root, file)
                            print(f"  Found: {src_file}")
                            local_output = f"./{file}"
                            shutil.copy(src_file, local_output)
                            print(f"  Copied to {local_output}")
            
        except subprocess.CalledProcessError as e:
            print(f"Error running Manim: {e}")
            if e.stdout:
                print(f"Stdout: {e.stdout.decode('utf-8')}")
            if e.stderr:
                print(f"Stderr: {e.stderr.decode('utf-8')}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    scene_name = "ContentScene"
    if len(sys.argv) > 1:
        scene_name = sys.argv[1]
    
    test_manim_locally(scene_name) 