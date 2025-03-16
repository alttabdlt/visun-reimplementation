import requests
import json
import time
import uuid
import os

# Generate a unique test ID
test_id = f"test_multi_step_{uuid.uuid4()}"
print(f"Testing with unique ID: {test_id}")

# The service URL
service_url = "https://manim-service-589284378993.us-central1.run.app"

# Create 3 different Manim scenes for testing multiple steps
scene_templates = [
    """
from manim import *

class TestScene1(Scene):
    def construct(self):
        # Step 1: Simple circle creation
        circle = Circle()
        circle.set_fill(BLUE, opacity=0.5)
        self.play(Create(circle))
        self.wait(1)
    """,
    
    """
from manim import *

class TestScene2(Scene):
    def construct(self):
        # Step 2: Square to triangle transformation
        square = Square()
        square.set_fill(RED, opacity=0.5)
        
        triangle = Triangle()
        triangle.set_fill(GREEN, opacity=0.5)
        
        self.play(Create(square))
        self.wait(1)
        self.play(Transform(square, triangle))
        self.wait(1)
    """,
    
    """
from manim import *

class TestScene3(Scene):
    def construct(self):
        # Step 3: Text animation
        text = Text("Animation Test")
        self.play(Write(text))
        self.wait(1)
        self.play(text.animate.set_color(YELLOW))
        self.wait(1)
    """
]

# Results storage
results = []

# Send each animation request
for step, scene_template in enumerate(scene_templates, start=1):
    print(f"\n===== Testing Step {step} =====")
    
    # Create the request payload
    code = scene_template.strip()
    print(f"\nSending Manim code for step {step}:\n{code[:200]}...\n")
    
    payload = {
        "code": code,
        "message_id": test_id,
        "step": step
    }
    
    # Send the request
    print(f"Sending request to {service_url}/execute-manim")
    start_time = time.time()
    response = requests.post(f"{service_url}/execute-manim", json=payload)
    duration = time.time() - start_time
    
    # Print the response
    print(f"Response received in {duration:.2f} seconds")
    print(f"Status code: {response.status_code}")
    
    # Parse the response
    if response.status_code == 200:
        response_data = response.json()
        print(f"Response: {json.dumps(response_data, indent=2)}")
        
        # Store the results
        results.append({
            "step": step,
            "status_code": response.status_code,
            "url": response_data.get("url"),
            "is_placeholder": "placeholder" in response_data.get("url", ""),
            "duration": duration
        })
    else:
        print(f"Error response: {response.text}")
        results.append({
            "step": step,
            "status_code": response.status_code,
            "error": response.text,
            "duration": duration
        })
        
    # Wait a bit between requests to avoid overwhelming the service
    time.sleep(2)

# Print a summary of results
print("\n===== TESTING SUMMARY =====")
success_count = sum(1 for r in results if r["status_code"] == 200)
placeholder_count = sum(1 for r in results if r.get("is_placeholder", False))
real_animation_count = success_count - placeholder_count

print(f"Total requests: {len(results)}")
print(f"Successful requests: {success_count}/{len(results)}")
print(f"Real animations: {real_animation_count}/{success_count}")
print(f"Placeholder animations: {placeholder_count}/{success_count}")

# Print detailed results
print("\nDetailed Results:")
for result in results:
    status = "✅ SUCCESS" if result["status_code"] == 200 else "❌ FAILED"
    if result["status_code"] == 200:
        animation_type = "📋 PLACEHOLDER" if result.get("is_placeholder", False) else "🎬 REAL ANIMATION"
        print(f"Step {result['step']}: {status} | {animation_type} | {result.get('url', 'N/A')} | {result['duration']:.2f}s")
    else:
        print(f"Step {result['step']}: {status} | Error: {result.get('error', 'Unknown error')} | {result['duration']:.2f}s")

print("\nCheck your Supabase Storage 'manim-code' bucket for files with this ID prefix:")
print(f"'{test_id}'")
print("\nCheck your Supabase Storage 'animations' bucket for the generated animations.") 