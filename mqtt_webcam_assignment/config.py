# MQTT Configuration
MQTT_BROKER = "localhost"  # Change to the IP address of your MQTT broker
MQTT_PORT = 1883
MQTT_CLIENT_ID_PREFIX = "webcam_"
MQTT_KEEPALIVE = 60

# MQTT Topics
TOPIC_REQUEST = "webcam/capture/request"
TOPIC_RESPONSE = "webcam/capture/response"
TOPIC_STATUS = "webcam/status"

# Webcam Configuration
WEBCAM_INDEX = 0  # Default webcam (usually 0)
CAPTURE_WIDTH = 640
CAPTURE_HEIGHT = 480
JPEG_QUALITY = 70  # 0-100, higher is better quality but larger file size

# System Configuration
RESPONSE_TIMEOUT = 10  # Seconds to wait for a response
MAX_IMAGE_SIZE = 1024 * 1024  # 1MB max image size
