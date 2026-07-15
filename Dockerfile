# AlphaLab v3 multi-stage production image

# Stage 1: Build frontend
FROM node:26-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install the complete build toolchain in the disposable builder stage.
# Frontend node_modules are not copied into the final runtime image.
RUN npm ci

# Copy source code
COPY frontend/ ./

# React environment values are public build-time configuration. Pass them with
# --build-arg; never copy backend secrets or local .env files into the image.
ARG REACT_APP_API_BASE_URL=/api
ARG REACT_APP_SUPABASE_URL
ARG REACT_APP_SUPABASE_ANON_KEY
ARG REACT_APP_TURNSTILE_SITE_KEY
ARG REACT_APP_ENV=production
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
ENV REACT_APP_SUPABASE_URL=$REACT_APP_SUPABASE_URL
ENV REACT_APP_SUPABASE_ANON_KEY=$REACT_APP_SUPABASE_ANON_KEY
ENV REACT_APP_TURNSTILE_SITE_KEY=$REACT_APP_TURNSTILE_SITE_KEY
ENV REACT_APP_ENV=$REACT_APP_ENV

# Build frontend
RUN npm run build

# Stage 2: Build backend
FROM python:3.11-slim AS backend-builder

WORKDIR /app/backend

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY backend/requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt || \
    pip install --no-cache-dir flask flask-cors requests pandas numpy yfinance pytz gunicorn

# Copy backend source
COPY backend/ ./

# Stage 3: Production image
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    nginx \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Copy backend from stage 2
COPY --from=backend-builder /app/backend ./backend
COPY --from=backend-builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=backend-builder /usr/local/bin /usr/local/bin

# Copy nginx configuration
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy startup script
COPY docker/start.sh ./start.sh
RUN chmod +x ./start.sh

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Environment variables
ENV PYTHONPATH=/app/backend
ENV FLASK_APP=start_quant_backend.py
ENV FLASK_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:8080/api/health || exit 1

# Start application
CMD ["./start.sh"]
