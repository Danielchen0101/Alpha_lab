# Deployment Guide

## Backend — Render

### Service Settings

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `gunicorn start_quant_backend:app --bind 0.0.0.0:$PORT` |

### Environment Variables

Set the following in Render Dashboard → Environment:

| Variable | Description | Example |
|----------|-------------|---------|
| `FRONTEND_ORIGIN` | Allowed CORS origin (Cloudflare Pages URL) | `https://your-project.pages.dev` |
| `FINNHUB_API_KEY` | Finnhub market data API key | `your_finnhub_key` |
| `ALPACA_API_KEY` | Alpaca trading API key | `your_alpaca_key` |
| `ALPACA_API_SECRET` | Alpaca trading API secret | `your_alpaca_secret` |
| `ALPACA_BASE_URL` | Alpaca API base URL | `https://paper-api.alpaca.markets` |
| `AI_API_KEY` | AI provider API key | `your_ai_key` |
| `AI_BASE_URL` | AI provider base URL | `https://api.deepseek.com` |
| `AI_MODEL` | AI model name | `deepseek-chat` |

> Do NOT commit real API keys. Use Render's environment variable panel.

### NVIDIA NIM (alternative AI provider)

To use NVIDIA hosted models instead of DeepSeek, set these in Render:

| Variable | Value |
|----------|-------|
| `AI_PROVIDER` | `NVIDIA NIM` |
| `AI_API_KEY` | Your NVIDIA API key |
| `AI_BASE_URL` | `https://integrate.api.nvidia.com/v1` |
| `AI_MODEL` | `deepseek-ai/deepseek-r1` |

> You can also configure NVIDIA NIM via the Settings page. The UI will auto-fill the correct Base URL and Model.

### Health Check

After deployment, verify:

```
https://your-service.onrender.com/api/health
```

Expected response:

```json
{"status": "ok"}
```

## Frontend — Cloudflare Pages

### Build Settings

| Setting | Value |
|---------|-------|
| Framework preset | Create React App |
| Build command | `npm run build` |
| Build output directory | `build` |
| Root directory | `frontend` |

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `REACT_APP_API_BASE_URL` | Backend API base URL | `https://your-service.onrender.com/api` |
| `REACT_APP_WS_BASE_URL` | WebSocket URL (if applicable) | `wss://your-service.onrender.com` |
