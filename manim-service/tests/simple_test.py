import requests
import json
import uuid

# A simple Manim scene that should definitely work
simple_scene = """
from manim import *

class SimpleScene(Scene):
    def construct(self):
        circle = Circle()
        circle.set_fill(BLUE, opacity=0.5)
        self.play(Create(circle))
        self.wait(1)
"""

# The service URL
service_url = "https://manim-service-589284378993.us-central1.run.app"

# Generate a unique test ID
test_id = f"simple_test_{uuid.uuid4()}"
print(f"Testing with ID: {test_id}")

# Create the request payload
payload = {
    "code": simple_scene.strip(),
    "message_id": test_id,
    "step": 1
}

# Send the request
print(f"Sending request to {service_url}/execute-manim")
response = requests.post(f"{service_url}/execute-manim", json=payload)

# Print the response
print(f"Status code: {response.status_code}")
if response.status_code == 200:
    response_data = response.json()
    print(f"Response: {json.dumps(response_data, indent=2)}")
    
    # Output helpful information
    url = response_data.get("url", "")
    is_placeholder = "placeholder" in url
    
    if is_placeholder:
        print("\n⚠️ WARNING: Received placeholder animation")
        print("This indicates the Manim service couldn't generate a real animation")
    else:
        print("\n✅ SUCCESS: Received real animation!")
        print(f"Animation URL: {url}")
else:
    print(f"Error response: {response.text}")