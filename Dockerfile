# Use Python 3.9 as base image
FROM python:3.9-slim

# Install system dependencies (FFmpeg is required for Whisper)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first (for caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Create necessary directories and set permissions
# Hugging Face Spaces runs as user 1000 by default
RUN mkdir -p uploads && \
    chmod 777 uploads && \
    touch super_ai_transcript.db && \
    chmod 777 super_ai_transcript.db && \
    chmod 777 /app

# Expose the standard Hugging Face port
EXPOSE 7860

# Set environment variable to tell Flask to use port 7860
ENV PORT=7860

# Command to run the application
CMD ["python", "app.py"]
