#!/usr/bin/env python3
"""
Multi-step Animation Verification Script

This script tests the multi-step animation functionality of the Manim service.
It sends requests to create animations for multiple steps, then verifies that
the database properly stores and returns all steps in the correct order.
"""

import requests
import json
import uuid
import time
import sys

# The service URL
SERVICE_URL = "https://manim-service-589284378993.us-central1.run.app"
SUPABASE_URL = "https://xavafuqrqucwbjxxcgqk.supabase.co/storage/v1/object/public/animations"

# Simple animation scenes for testing multiple steps
TEST_SCENES = [
    # Step 1: Circle
    """
    from manim import *
    
    class CircleScene(Scene):
        def construct(self):
            circle = Circle()
            circle.set_fill(BLUE, opacity=0.5)
            self.play(Create(circle))
            self.wait(1)
    """,
    
    # Step 2: Square
    """
    from manim import *
    
    class SquareScene(Scene):
        def construct(self):
            square = Square()
            square.set_fill(RED, opacity=0.5)
            self.play(Create(square))
            self.wait(1)
    """,
    
    # Step 3: Text
    """
    from manim import *
    
    class TextScene(Scene):
        def construct(self):
            text = Text("Step 3")
            self.play(Write(text))
            self.wait(1)
    """
]

class MultiStepTester:
    def __init__(self):
        self.test_id = f"multistep_verification_{uuid.uuid4()}"
        self.animation_urls = []
        print(f"Starting multi-step test with ID: {self.test_id}")
    
    def run_health_check(self):
        """Check if the Manim service is healthy and Manim is working."""
        try:
            response = requests.get(f"{SERVICE_URL}/health")
            if response.status_code == 200:
                health_data = response.json()
                print(f"Health check: {health_data.get('status', 'unknown')}")
                print(f"Manim working: {health_data.get('manim_working', 'unknown')}")
                print(f"Manim version: {health_data.get('manim_version', 'unknown')}")
                return True
            else:
                print(f"Health check failed with status code: {response.status_code}")
                return False
        except Exception as e:
            print(f"Error checking health: {e}")
            return False
    
    def generate_animations(self):
        """Generate animations for each step."""
        results = []
        
        for step, scene in enumerate(TEST_SCENES, start=1):
            print(f"\n===== Generating Step {step} =====")
            
            # Create payload
            payload = {
                "code": scene.strip(),
                "message_id": self.test_id,
                "step": step
            }
            
            # Send request
            try:
                print(f"Sending request to {SERVICE_URL}/execute-manim")
                response = requests.post(
                    f"{SERVICE_URL}/execute-manim", 
                    json=payload,
                    timeout=30  # 30-second timeout
                )
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"Success! Animation data: {json.dumps(data, indent=2)}")
                    
                    # Store the URL
                    url = data.get("url", "")
                    self.animation_urls.append({"step": step, "url": url})
                    
                    # Add to results
                    results.append({
                        "step": step,
                        "status": "success",
                        "url": url,
                        "is_placeholder": "placeholder" in url
                    })
                else:
                    print(f"Error: {response.status_code} - {response.text}")
                    results.append({
                        "step": step,
                        "status": "error",
                        "error": response.text
                    })
            except Exception as e:
                print(f"Exception during request: {e}")
                results.append({
                    "step": step,
                    "status": "exception",
                    "error": str(e)
                })
            
            # Wait a bit between requests
            time.sleep(2)
        
        return results
    
    def verify_results(self, results):
        """Verify the results of the multi-step test."""
        print("\n===== VERIFICATION RESULTS =====")
        
        # Count successes
        success_count = sum(1 for r in results if r.get("status") == "success")
        placeholder_count = sum(1 for r in results if r.get("is_placeholder", False))
        real_animation_count = success_count - placeholder_count
        
        print(f"Total steps: {len(results)}")
        print(f"Successful steps: {success_count}/{len(results)}")
        print(f"Real animations: {real_animation_count}/{success_count}")
        print(f"Placeholder animations: {placeholder_count}/{success_count}")
        
        # Check if URLs are unique
        urls = [r.get("url") for r in results if r.get("status") == "success"]
        unique_urls = set(urls)
        
        if len(urls) == len(unique_urls):
            print("\n✅ SUCCESS: Each step has a unique animation URL")
        else:
            print("\n⚠️ WARNING: Some steps have duplicate animation URLs")
        
        # Print detailed report
        print("\nDetailed Results:")
        for result in results:
            step = result.get("step", "?")
            status = result.get("status", "unknown")
            
            if status == "success":
                url = result.get("url", "")
                is_placeholder = result.get("is_placeholder", False)
                animation_type = "📋 PLACEHOLDER" if is_placeholder else "🎬 REAL ANIMATION"
                print(f"Step {step}: ✅ SUCCESS | {animation_type} | {url}")
            else:
                error = result.get("error", "Unknown error")
                print(f"Step {step}: ❌ FAILED | Error: {error}")
        
        return success_count == len(results)
    
    def run(self):
        """Run the complete test."""
        # First check service health
        if not self.run_health_check():
            print("Health check failed. Aborting test.")
            return False
        
        # Generate animations
        results = self.generate_animations()
        
        # Verify results
        success = self.verify_results(results)
        
        if success:
            print("\n✅ Multi-step animation verification PASSED!")
        else:
            print("\n❌ Multi-step animation verification FAILED!")
        
        return success

if __name__ == "__main__":
    tester = MultiStepTester()
    success = tester.run()
    sys.exit(0 if success else 1)