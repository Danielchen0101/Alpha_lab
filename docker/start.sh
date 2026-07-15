#!/bin/bash

# AlphaLab v3 container entrypoint

set -e

echo "========================================"
echo "Starting Quantitative Trading Platform"
echo "========================================"

# Check environment variables
if [ -z "$FINNHUB_API_KEY" ]; then
    echo "WARNING: FINNHUB_API_KEY is not set"
fi

if [ -z "$ALPACA_API_KEY" ]; then
    echo "WARNING: ALPACA_API_KEY is not set"
fi

# Start backend with gunicorn
echo "Starting backend server..."
cd /app/backend
export MALLOC_ARENA_MAX="${MALLOC_ARENA_MAX:-2}"

# The scheduler is in-process. Production must use exactly one worker so there
# is exactly one scan/order scheduler; threads provide concurrent API handling.
if [ "$FLASK_ENV" = "production" ]; then
    echo "Starting in production mode with gunicorn"
    if ! command -v gunicorn >/dev/null 2>&1; then
        echo "ERROR: gunicorn is not installed in the runtime image"
        exit 1
    fi
    gunicorn \
        --bind 127.0.0.1:5000 \
        --workers 1 \
        --threads 4 \
        --timeout 900 \
        --access-logfile - \
        --error-logfile - \
        --log-level info \
        start_quant_backend:app &
else
    echo "Starting in development mode"
    python start_quant_backend.py &
fi

BACKEND_PID=$!

# Start nginx
echo "Starting nginx..."
nginx -g "daemon off;" &

NGINX_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to be ready..."
max_attempts=30
attempt=1
while ! curl -f http://127.0.0.1:5000/api/health >/dev/null 2>&1; do
    if [ $attempt -eq $max_attempts ]; then
        echo "Backend failed to start after $max_attempts attempts"
        exit 1
    fi
    echo "Attempt $attempt/$max_attempts: Backend not ready yet..."
    sleep 2
    attempt=$((attempt + 1))
done

echo "Backend is ready!"
echo "Frontend is available at http://localhost:8080"
echo "API is available at http://localhost:8080/api"

# Health check function
health_check() {
    if ! kill -0 $BACKEND_PID >/dev/null 2>&1; then
        echo "Backend process died"
        return 1
    fi
    
    if ! kill -0 $NGINX_PID >/dev/null 2>&1; then
        echo "Nginx process died"
        return 1
    fi
    
    if ! curl -f http://127.0.0.1:8080/api/health >/dev/null 2>&1; then
        echo "Health check failed"
        return 1
    fi
    
    return 0
}

# Monitor processes
echo "Platform is running. Monitoring processes..."
trap 'echo "Shutting down..."; kill $BACKEND_PID $NGINX_PID; exit 0' SIGINT SIGTERM

while health_check; do
    sleep 30
done

echo "Platform health check failed. Shutting down..."
kill $BACKEND_PID $NGINX_PID 2>/dev/null || true
exit 1
