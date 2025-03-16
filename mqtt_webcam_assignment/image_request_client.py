#!/usr/bin/env python3
"""
Image Request Client - MQTT Publisher & Subscriber
Sends requests to capture images and receives the captured images.
"""

import os
import time
import json
import base64
import logging
import uuid
import paho.mqtt.client as mqtt
from datetime import datetime
from PIL import Image
import io
import sys
import signal
import config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('image_request_client')

# Global variables
client = None
pending_requests = {}
output_dir = "captured_images"

def on_connect(client, userdata, flags, rc):
    """Callback when connected to MQTT broker"""
    if rc == 0:
        logger.info("Connected to MQTT broker")
        # Subscribe to the response topic
        client.subscribe(config.TOPIC_RESPONSE)
        # Subscribe to the status topic
        client.subscribe(config.TOPIC_STATUS)
    else:
        logger.error(f"Failed to connect to MQTT broker with code {rc}")

def on_message(client, userdata, msg):
    """Callback when message is received"""
    try:
        logger.info(f"Received message on topic {msg.topic}")
        
        if msg.topic == config.TOPIC_STATUS:
            # Process status message
            try:
                status = json.loads(msg.payload.decode())
                logger.info(f"Capture service status: {status.get('status', 'unknown')}")
            except json.JSONDecodeError:
                logger.warning("Received invalid status message format")
        
        elif msg.topic == config.TOPIC_RESPONSE:
            # Process image response
            try:
                response = json.loads(msg.payload.decode())
                
                # Check if this is a success response with an image
                if response.get("status") == "success" and "image" in response:
                    request_id = response.get("request_id", "unknown")
                    
                    # Check if this is a response to a pending request
                    if request_id in pending_requests:
                        # Get the request timestamp
                        request_time = pending_requests[request_id]
                        response_time = datetime.now()
                        latency = (response_time - request_time).total_seconds()
                        
                        logger.info(f"Received image for request {request_id} (latency: {latency:.2f}s)")
                        
                        # Save the image
                        save_image(response["image"], request_id)
                        
                        # Remove from pending requests
                        del pending_requests[request_id]
                    else:
                        logger.warning(f"Received response for unknown request: {request_id}")
                
                # Check if this is an error response
                elif response.get("status") == "error":
                    request_id = response.get("request_id", "unknown")
                    error_msg = response.get("message", "Unknown error")
                    logger.error(f"Error for request {request_id}: {error_msg}")
                    
                    # Remove from pending requests if it exists
                    if request_id in pending_requests:
                        del pending_requests[request_id]
                
                else:
                    logger.warning("Received response with invalid format")
            
            except json.JSONDecodeError:
                logger.warning("Received invalid response message format")
            except Exception as e:
                logger.error(f"Error processing response: {e}")
    
    except Exception as e:
        logger.error(f"Error in message handler: {e}")

def save_image(img_base64, request_id):
    """Save the received image to disk"""
    try:
        # Create output directory if it doesn't exist
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        # Decode base64 image
        img_data = base64.b64decode(img_base64)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{output_dir}/image_{timestamp}_{request_id[:8]}.jpg"
        
        # Save image
        with open(filename, "wb") as f:
            f.write(img_data)
        
        logger.info(f"Image saved to {filename}")
        
        # Optionally display the image (if running in a GUI environment)
        try:
            img = Image.open(io.BytesIO(img_data))
            img.show()
        except Exception as e:
            logger.warning(f"Could not display image: {e}")
    
    except Exception as e:
        logger.error(f"Error saving image: {e}")

def request_image():
    """Send a request to capture an image"""
    try:
        # Generate a unique request ID
        request_id = str(uuid.uuid4())
        
        # Create request message
        request = {
            "command": "capture",
            "request_id": request_id,
            "timestamp": datetime.now().isoformat()
        }
        
        # Publish request
        client.publish(config.TOPIC_REQUEST, json.dumps(request))
        
        # Store request in pending requests
        pending_requests[request_id] = datetime.now()
        
        logger.info(f"Image capture requested with ID: {request_id}")
        return request_id
    
    except Exception as e:
        logger.error(f"Error requesting image: {e}")
        return None

def check_pending_requests():
    """Check for timed out requests"""
    current_time = datetime.now()
    timed_out = []
    
    for request_id, request_time in pending_requests.items():
        # Calculate how long the request has been pending
        elapsed = (current_time - request_time).total_seconds()
        
        # Check if request has timed out
        if elapsed > config.RESPONSE_TIMEOUT:
            logger.warning(f"Request {request_id} timed out after {elapsed:.2f}s")
            timed_out.append(request_id)
    
    # Remove timed out requests
    for request_id in timed_out:
        del pending_requests[request_id]

def cleanup(signum, frame):
    """Clean up resources before exiting"""
    logger.info("Cleaning up resources...")
    
    if client:
        client.disconnect()
    
    logger.info("Cleanup complete, exiting")
    sys.exit(0)

def interactive_mode():
    """Run in interactive mode, allowing user to request images on demand"""
    print("\nImage Request Client - Interactive Mode")
    print("---------------------------------------")
    print("Press 'c' to capture an image")
    print("Press 'q' to quit")
    
    while True:
        cmd = input("> ").strip().lower()
        
        if cmd == 'c':
            request_image()
        elif cmd == 'q':
            break
        else:
            print("Unknown command. Press 'c' to capture or 'q' to quit.")
        
        # Check for timed out requests
        check_pending_requests()
        
        # Small delay to prevent CPU hogging
        time.sleep(0.1)

def main():
    """Main function"""
    global client
    
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    
    # Initialize MQTT client
    client_id = f"{config.MQTT_CLIENT_ID_PREFIX}request_client_{int(time.time())}"
    client = mqtt.Client(client_id)
    
    # Set callbacks
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        # Connect to MQTT broker
        logger.info(f"Connecting to MQTT broker at {config.MQTT_BROKER}:{config.MQTT_PORT}")
        client.connect(config.MQTT_BROKER, config.MQTT_PORT, config.MQTT_KEEPALIVE)
        
        # Start the MQTT loop in a background thread
        client.loop_start()
        
        # Run in interactive mode
        interactive_mode()
        
        # Stop the MQTT loop
        client.loop_stop()
        
        # Disconnect from the broker
        client.disconnect()
    
    except KeyboardInterrupt:
        cleanup(None, None)
    except Exception as e:
        logger.error(f"Error in main loop: {e}")
        cleanup(None, None)

if __name__ == "__main__":
    main()
