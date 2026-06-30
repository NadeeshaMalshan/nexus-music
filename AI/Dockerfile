# Use official lightweight Python image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PORT=7860

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Create directory for public covers
RUN mkdir -p public/covers

# Expose Hugging Face Space default port
EXPOSE 7860

# Run FastAPI app with uvicorn on port 7860
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
