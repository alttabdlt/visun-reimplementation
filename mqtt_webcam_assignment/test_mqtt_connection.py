#!/usr/bin/env python3
"""
MQTT Connection Test Utility
Tests connection to the MQTT broker and basic publish/subscribe functionality.
"""

import paho.mqtt.client as mqtt
import time
import json
import logging
import sys
import config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('mqtt_test')

# Global variables
client = None
received_messages = 0
test_topic = "test/mqtt/connection"

def on_connect(client, userdata, flags, rc):
    """Callback when connected to MQTT broker"""
    if rc == 0:
        logger.info("Connected to MQTT broker successfully")
        client.subscribe(test_topic)
        logger.info(f"Subscribed to topic: {test_topic}")
    else:
        logger.error(f"Failed to connect to MQTT broker with code {rc}")
        sys.exit(1)

def on_message(client, userdata, msg):
    """Callback when message is received"""
    global received_messages
    try:
        payload = msg.payload.decode()
        logger.info(f"Received message on topic {msg.topic}: {payload}")
        received_messages += 1
    except Exception as e:
        logger.error(f"Error processing message: {e}")

def on_publish(client, userdata, mid):
    """Callback when message is published"""
    logger.info(f"Message {mid} published successfully")

def on_disconnect(client, userdata, rc):
    """Callback when disconnected from MQTT broker"""
    if rc != 0:
        logger.warning(f"Unexpected disconnection from MQTT broker: {rc}")
    else:
        logger.info("Disconnected from MQTT broker")

def main():
    """Main function"""
    global client
    
    # Initialize MQTT client
    client_id = f"mqtt_test_client_{int(time.time())}"
    client = mqtt.Client(client_id)
    
    # Set callbacks
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_publish = on_publish
    client.on_disconnect = on_disconnect
    
    try:
        # Connect to MQTT broker
        logger.info(f"Connecting to MQTT broker at {config.MQTT_BROKER}:{config.MQTT_PORT}")
        client.connect(config.MQTT_BROKER, config.MQTT_PORT, config.MQTT_KEEPALIVE)
        
        # Start the MQTT loop in a background thread
        client.loop_start()
        
        # Wait for connection to establish
        time.sleep(1)
        
        # Publish test messages
        for i in range(3):
            message = {
                "test_id": i,
                "timestamp": time.time(),
                "message": f"Test message {i}"
            }
            logger.info(f"Publishing message {i} to {test_topic}")
            client.publish(test_topic, json.dumps(message))
            time.sleep(1)
        
        # Wait for messages to be received
        logger.info("Waiting for messages to be received...")
        time.sleep(3)
        
        # Check if messages were received
        if received_messages > 0:
            logger.info(f"Test successful! Received {received_messages} messages")
        else:
            logger.warning("No messages were received. Check broker configuration.")
        
        # Disconnect from the broker
        client.disconnect()
        client.loop_stop()
        
    except KeyboardInterrupt:
        logger.info("Test interrupted by user")
        client.disconnect()
        client.loop_stop()
    except Exception as e:
        logger.error(f"Error in main loop: {e}")
        if client:
            client.disconnect()
            client.loop_stop()

if __name__ == "__main__":
    main()
