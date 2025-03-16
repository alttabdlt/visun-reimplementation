#!/usr/bin/env python3
"""
Image Capture Service - MQTT Subscriber
Listens for image capture requests and responds with captured webcam images.
"""

import cv2
import time
import json
import base64
import logging
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
logger = logging.getLogger('image_capture_service')

# Global variables
client = None
camera = None

def setup_camera():
    """Initialize the webcam"""
    try:
        cam = cv2.VideoCapture(config.WEBCAM_INDEX)
        cam.set(cv2.CAP_PROP_FRAME_WIDTH, config.CAPTURE_WIDTH)
        cam.set(cv2.CAP_PROP_FRAME_HEIGHT, config.CAPTURE_HEIGHT)
        
        # Check if camera opened successfully
        if not cam.isOpened():
            logger.error("Failed to open webcam")
            return None
            
        logger.info("Webcam initialized successfully")
        return cam
    except Exception as e:
        logger.error(f"Error initializing webcam: {e}")
        return None

def capture_image():
    """Capture an image from the webcam"""
    if camera is None:
        logger.error("Camera not initialized")
        return None
    
    try:
        # Read frame from webcam
        ret, frame = camera.read()
        if not ret:
            logger.error("Failed to capture image")
            return None
        
        # Convert to PIL Image for easier processing
        img = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img)
        
        # Compress image to reduce size
        img_byte_arr = io.BytesIO()
        pil_img.save(img_byte_arr, format='JPEG', quality=config.JPEG_QUALITY)
        img_byte_arr.seek(0)
        
        # Check if image size is within limits
        if img_byte_arr.getbuffer().nbytes > config.MAX_IMAGE_SIZE:
            logger.warning("Image size exceeds limit, reducing quality")
            for quality in [60, 50, 40, 30, 20]:
                img_byte_arr = io.BytesIO()
                pil_img.save(img_byte_arr, format='JPEG', quality=quality)
                if img_byte_arr.getbuffer().nbytes <= config.MAX_IMAGE_SIZE:
                    break
            img_byte_arr.seek(0)
        
        # Encode image as base64 string
        img_base64 = base64.b64encode(img_byte_arr.read()).decode('utf-8')
        
        logger.info(f"Image captured successfully: {len(img_base64)} bytes")
        return img_base64
    except Exception as e:
        logger.error(f"Error capturing image: {e}")
        return None

def on_connect(client, userdata, flags, rc):
    """Callback when connected to MQTT broker"""
    if rc == 0:
        logger.info("Connected to MQTT broker")
        # Subscribe to the request topic
        client.subscribe(config.TOPIC_REQUEST)
        # Publish status message
        status_msg = {
            "status": "online",
            "timestamp": datetime.now().isoformat()
        }
        client.publish(config.TOPIC_STATUS, json.dumps(status_msg))
    else:
        logger.error(f"Failed to connect to MQTT broker with code {rc}")

def on_message(client, userdata, msg):
    """Callback when message is received"""
    try:
        logger.info(f"Received message on topic {msg.topic}")
        
        # Parse the request
        try:
            request = json.loads(msg.payload.decode())
        except json.JSONDecodeError:
            # If not JSON, treat as simple trigger
            request = {"command": "capture"}
        
        # Process the request
        if request.get("command") == "capture":
            # Capture image
            img_base64 = capture_image()
            
            if img_base64:
                # Prepare response
                response = {
                    "status": "success",
                    "timestamp": datetime.now().isoformat(),
                    "image": img_base64,
                    "format": "jpeg",
                    "request_id": request.get("request_id", "unknown")
                }
                
                # Publish response
                client.publish(config.TOPIC_RESPONSE, json.dumps(response))
                logger.info("Image published successfully")
            else:
                # Error response
                error_response = {
                    "status": "error",
                    "message": "Failed to capture image",
                    "timestamp": datetime.now().isoformat(),
                    "request_id": request.get("request_id", "unknown")
                }
                client.publish(config.TOPIC_RESPONSE, json.dumps(error_response))
                logger.error("Failed to capture and publish image")
    except Exception as e:
        logger.error(f"Error processing message: {e}")

def on_disconnect(client, userdata, rc):
    """Callback when disconnected from MQTT broker"""
    if rc != 0:
        logger.warning(f"Unexpected disconnection from MQTT broker: {rc}")
    else:
        logger.info("Disconnected from MQTT broker")

def cleanup(signum, frame):
    """Clean up resources before exiting"""
    logger.info("Cleaning up resources...")
    
    # Publish offline status
    if client:
        status_msg = {
            "status": "offline",
            "timestamp": datetime.now().isoformat()
        }
        client.publish(config.TOPIC_STATUS, json.dumps(status_msg))
        client.disconnect()
    
    # Release camera
    if camera:
        camera.release()
    
    logger.info("Cleanup complete, exiting")
    sys.exit(0)

def main():
    """Main function"""
    global client, camera
    
    # Set up signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)
    
    # Initialize camera
    camera = setup_camera()
    if camera is None:
        logger.error("Failed to initialize camera, exiting")
        sys.exit(1)
    
    # Initialize MQTT client
    client_id = f"{config.MQTT_CLIENT_ID_PREFIX}capture_service_{int(time.time())}"
    client = mqtt.Client(client_id)
    
    # Set callbacks
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect
    
    try:
        # Connect to MQTT broker
        logger.info(f"Connecting to MQTT broker at {config.MQTT_BROKER}:{config.MQTT_PORT}")
        client.connect(config.MQTT_BROKER, config.MQTT_PORT, config.MQTT_KEEPALIVE)
        
        # Start the MQTT loop
        logger.info("Starting MQTT loop")
        client.loop_forever()
    except KeyboardInterrupt:
        cleanup(None, None)
    except Exception as e:
        logger.error(f"Error in main loop: {e}")
        cleanup(None, None)

if __name__ == "__main__":
    main()
