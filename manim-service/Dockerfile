FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libcairo2-dev \
    build-essential \
    gcc \
    pkg-config \
    python3-dev \
    texlive-full \
    texlive-latex-extra \
    texlive-fonts-extra \
    texlive-latex-recommended \
    texlive-science \
    tipa \
    libpango1.0-dev \
    libgdk-pixbuf2.0-dev \
    libffi-dev \
    xvfb \
    sox \
    libsox-fmt-all \
    libcairo2 \
    libpango1.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy just the requirements first to leverage Docker cache
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Verify manim installation and create test animation to ensure everything works
RUN echo "from manim import *; print('Manim version:', __import__('manim').__version__)" > test.py && python test.py

# Copy the rest of the application
COPY . .

# Create media directory for Manim
RUN mkdir -p /app/media/videos
RUN mkdir -p /app/media/temp_files
RUN mkdir -p /app/media/cache

# Generate a placeholder animation on build using ffmpeg
RUN apt-get update && apt-get install -y ffmpeg
RUN ffmpeg -f lavfi -i "color=c=blue:s=640x360:d=3" \
    -vf "drawtext=text='Loading Animation...':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=(h-text_h)/2" \
    -y /app/media/placeholder-animation.mp4

# Expose port 8080 for the Flask app
EXPOSE 8080

# Command to run the app with gunicorn
CMD exec gunicorn --bind :8080 --workers 2 --threads 4 --timeout 0 wsgi:app