FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

# Copy pyproject.toml
COPY pyproject.toml ./

# Install Python dependencies using uv
RUN uv pip install --system --no-cache-dir -e .

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data/episodes

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Expose port
EXPOSE ${PORT}

# Run the application
CMD sh -c "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}" 