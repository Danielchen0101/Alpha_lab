# AlphaLab deployment

AlphaLab supports two production layouts:

1. a separately hosted React frontend and Flask backend; or
2. the repository Docker image, which serves the built frontend through Nginx and proxies `/api` to Gunicorn.

Both layouts use Supabase for authentication, user configuration, and durable pipeline state.

## Production constraint: one scheduler owner

The background research scheduler runs inside the Flask application. Run exactly one Gunicorn worker so there is only one scheduler that can scan, submit an eligible order, or reconcile a managed position. The supported command is:

```bash
gunicorn start_quant_backend:app \
  --bind 0.0.0.0:$PORT \
  --workers 1 \
  --threads 8 \
  --timeout 180
```

Threads can absorb concurrent HTTP requests. Do not add web workers unless the scheduler is first moved to a dedicated service with distributed ownership.

## Supabase

Create a project and apply [`backend/supabase_schema.sql`](backend/supabase_schema.sql) in the SQL editor. Record:

- the project URL;
- the public anonymous key for the React build;
- the service-role key for the Flask backend.

The service-role key is a server secret. It must never appear in a React environment variable, client bundle, issue, log, or screenshot.

## Split deployment

### Backend on Render

Configure a Python web service:

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Build command | `pip install -r requirements.txt` |
| Start command | `gunicorn start_quant_backend:app --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 180` |
| Health path | `/api/health` |

Required backend variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Auth and durable application state |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access |
| `FERNET_KEY` | Encryption for saved provider credentials |
| `APP_SECRET_KEY` | Flask session and application signing secret |
| `FRONTEND_ORIGIN` | Exact deployed frontend origin allowed by CORS |

Optional bootstrap variables are `ALPHALAB_ADMIN_EMAIL` and `ALPHALAB_ADMIN_PASSWORD`. Provider credentials are normally entered per user under **Settings → Connections**. Environment-level Alpaca, Finnhub, and AI values remain useful only for controlled server fallback or migration scenarios.

Use an always-on paid web-service instance for scheduled research or position protection. A free service that sleeps after inactivity stops the scheduler and managed-position guard until the process wakes again. Pipeline schedules, run history, and managed stop/target plans are stored in Supabase; local JSON files are development and recovery mirrors, not durable production storage.

### Frontend on Cloudflare Pages

| Setting | Value |
| --- | --- |
| Framework | Create React App |
| Root directory | `frontend` |
| Build command | `npm ci && npm run build` |
| Output directory | `build` |
| Node.js | 20 or newer |

Build-time variables:

| Variable | Purpose |
| --- | --- |
| `REACT_APP_API_BASE_URL` | Public backend URL ending in `/api` |
| `REACT_APP_SUPABASE_URL` | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Public browser-safe Supabase key |
| `REACT_APP_TURNSTILE_SITE_KEY` | Optional public Turnstile site key |

The repository's `frontend/public/_headers` supplies the production security headers. Confirm the deployed response includes the expected Content Security Policy before enabling sign-in.

## Docker deployment

Build the all-in-one image with public React configuration as build arguments:

```bash
docker build \
  --build-arg REACT_APP_API_BASE_URL=/api \
  --build-arg REACT_APP_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg REACT_APP_SUPABASE_ANON_KEY=your-public-anon-key \
  --build-arg REACT_APP_TURNSTILE_SITE_KEY=your-public-site-key \
  -t alphalab:3.0.0 .
```

Run it with backend secrets supplied at runtime:

```bash
docker run --rm -p 8080:8080 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  -e FERNET_KEY=your-fernet-key \
  -e APP_SECRET_KEY=your-application-secret \
  -e FRONTEND_ORIGIN=https://your-alphalab.example \
  alphalab:3.0.0
```

Nginx listens on port `8080`, serves the SPA, proxies `/api`, and writes access/error output to the container logs. The image health check calls `http://127.0.0.1:8080/api/health`.

## Post-deployment checks

1. `GET /api/health` returns HTTP 200.
2. Public routes load directly and after a browser refresh.
3. Sign-in completes through the deployed Supabase project.
4. System Health distinguishes configured, verified, and online services.
5. A paper-mode market scan completes and persists its evidence.
6. The application has one scheduler owner.
7. Live credentials and order authority remain disabled until risk settings are reviewed.

## Rollback

Keep the preceding application image and database migration record. Rolling back code does not automatically reverse Supabase schema changes. Prefer additive schema migrations, disable live order authority first, and restore the last known application image only after confirming that its expected tables and columns remain available.
