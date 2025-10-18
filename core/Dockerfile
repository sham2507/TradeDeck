FROM python:3.11-slim

WORKDIR /app

# Copy only requirements first to use Docker layer caching
COPY requirements.txt ./

# Install dependencies and Supervisor
RUN apt-get update && apt-get install -y supervisor && \
    pip install --no-cache-dir -r requirements.txt && \
    rm -rf /var/lib/apt/lists/*

# Create Supervisor config directory
RUN mkdir -p /etc/supervisor/conf.d

# Copy application code and Supervisor config
COPY . /app
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Command to run Supervisor
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]

