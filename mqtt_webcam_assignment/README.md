# MQTT Webcam Image Capture and Transmission System

This project implements a system that captures images from a webcam when triggered via MQTT and transmits the captured images through MQTT.

## Overview

The system consists of two main components:

1. **Image Capture Service** (`image_capture_service.py`): Subscribes to a command topic and captures an image when triggered.
2. **Image Request Client** (`image_request_client.py`): Sends commands to request image capture and receives the captured images.

## Requirements

- Raspberry Pi 400 with webcam
- Python 3.7+
- MQTT Broker (Mosquitto)
- Dependencies listed in `requirements.txt`

## Installation

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Ensure the MQTT broker is running on your Raspberry Pi or another device.

## Configuration

Edit the configuration in `config.py` to set:
- MQTT broker IP address
- MQTT topics
- Image quality settings

## Usage

1. Start the MQTT broker if not already running:
   ```
   sudo systemctl start mosquitto
   ```

2. Run the image capture service:
   ```
   python image_capture_service.py
   ```

3. In another terminal, run the image request client:
   ```
   python image_request_client.py
   ```

4. The client will send image capture requests, and the service will respond by capturing and sending images.

## Topics

- `webcam/capture/request`: Topic for requesting an image capture
- `webcam/capture/response`: Topic for sending the captured image
- `webcam/status`: Topic for service status updates

## Implementation Details

The system uses Base64 encoding to transmit images over MQTT. The captured images are compressed to reduce transmission size while maintaining reasonable quality.
