# AlphaLab deployment

AlphaLab supports two production layouts:

1. a separately hosted React frontend and Flask backend; or
2. the repository Docker image, which serves the built frontend through Nginx and proxies `/api` to Gunicorn.

Both layouts use Supabase for authentication, user configuration, durable pipeline state, Safety Center controls, operational records, and cross-device artifacts.

## Production constraint: one scheduler owner

The background research scheduler runs inside the Flask application. Run exactly one Gunicorn worker so there is only one scheduler that can scan, submit an eligible order, or reconcile a managed position. The supported command is:

```bash
MALLOC_ARENA_MAX=2 gunicorn start_quant_backend:app \
  --bind 0.0.0.0:$PORT \
  --workers 1 \
  --threads 4 \
  --timeout 900
```

Four request threads fit the Render Pro 2-CPU profile while leaving room for two admitted heavy scans. Do not add web workers unless the scheduler is first moved to a dedicated service with distributed ownership.

## Supabase and required migrations

Create a project and apply the repository SQL files in this order:

1. [`backend/supabase_schema.sql`](backend/supabase_schema.sql) — encrypted user configuration, workspace preferences, scheduler configuration, and pipeline history.
2. [`backend/supabase_operations_store.sql`](backend/supabase_operations_store.sql) — durable Safety Center state, readiness, audit events, order lifecycle, notification delivery, and versioned cross-device artifacts.
3. [`backend/supabase_security_hardening.sql`](backend/supabase_security_hardening.sql) — browser-role write lockdown, owner-only reads, and database security hardening.

The operations migration is mandatory, not an optional feature migration. Production real new-entry checks fail closed if the operations store cannot be read. Safety Center and artifact writes return HTTP 503 rather than silently falling back to local files.

After applying all three files, run this verification query in the Supabase SQL editor. Every result must contain a table name rather than `null`:

```sql
select
  to_regclass('public.user_operations_safety_state') as safety_state,
  to_regclass('public.user_operations_audit_events') as audit_events,
  to_regclass('public.user_notification_delivery_events') as notification_events,
  to_regclass('public.user_order_lifecycle_events') as order_events,
  to_regclass('public.user_readiness_status') as readiness_status,
  to_regclass('public.user_operation_artifacts') as operation_artifacts;
```

Record:

- the project URL;
- the public anonymous key for the React build;
- the service-role key for the Flask backend.

The service-role key is a server secret. It must never appear in a React environment variable, client bundle, issue, log, or screenshot.

Local operations JSON fallback is permitted only for development and tests. Do not set `OPERATIONS_STORE_LOCAL_FALLBACK=true` on a hosted production service. Render deployments disable this fallback even if it is requested.

## Split deployment

### Backend on Render

Configure a Python web service:

| Setting | Value |
| --- | --- |
| Root directory | `backend` |
| Build command | `pip install -r requirements.txt` |
| Start command | `MALLOC_ARENA_MAX=2 gunicorn start_quant_backend:app --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 900` |
| Health path | `/api/health` |
| Instance count | `1` (the in-process scheduler must have one owner) |

Required backend variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Auth and durable application state |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database access |
| `FERNET_KEY` | Encryption for saved provider credentials |
| `APP_SECRET_KEY` | Flask session and application signing secret |
| `FRONTEND_ORIGIN` | Exact deployed frontend origin allowed by CORS |
| `FLASK_ENV` | Set to `production`; prevents development-only behavior |

For the Render Pro 4 GB / 2 CPU plan, use these runtime guards:

| Variable | Recommended value | Purpose |
| --- | ---: | --- |
| `BACKEND_PLAN_MEMORY_MB` | `4096` | Declares the service memory budget |
| `BACKEND_MEMORY_SOFT_LIMIT_MB` | `3200` | Starts collection and heap trimming before pressure becomes critical |
| `BACKEND_MEMORY_ABORT_LIMIT_MB` | `3700` | Stops a scan cleanly before Render hard-kills the process |
| `MARKET_SCAN_MAX_CONCURRENT` | `2` | Caps direct scans and holds the same slots for each full research pipeline |
| `MARKET_SCAN_HEADLESS_WAIT_SECONDS` | `600` | Bounds direct headless scanner waits; scheduled pipelines defer before spawning when capacity is full |
| `MALLOC_ARENA_MAX` | `2` | Reduces glibc heap fragmentation in the threaded worker |

Optional bootstrap variables are `ALPHALAB_ADMIN_EMAIL` and `ALPHALAB_ADMIN_PASSWORD`. Provider credentials are normally entered per user under **Settings → Connections**. Environment-level Alpaca, Finnhub, and AI values remain useful only for controlled server fallback or migration scenarios.

Use an always-on paid web-service instance for scheduled research or position protection. A free service that sleeps after inactivity stops the scheduler and managed-position guard until the process wakes again. Pipeline schedules, run history, and managed stop/target plans are stored in Supabase. Safety Center state and user artifacts are durable Supabase records as well; local JSON files are development and recovery mirrors, not durable production storage.

## Safety Center and protective exits

The Safety Center separates new-entry authority from position protection:

- pausing new entries blocks new real entry submissions through the durable server-side check;
- the optional cancellation action targets only open AlphaLab-managed buy entry orders;
- protective sell, stop, and OCO orders are retained;
- resuming entries uses the stored version so a stale browser cannot overwrite a newer safety decision.

Broker-side protective orders remain at Alpaca if the web page closes. Ongoing reconciliation and the managed-position guard are still in-process backend tasks, so they require the same always-on single backend process described above. This release does not include an independent guard worker or distributed scheduler owner.

If the operations migration, Supabase service access, or durable Safety Center read is unavailable, real new-entry execution remains blocked. Do not bypass this condition by enabling local fallback in production.

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
3. Sign-in completes through the deployed Supabase project; an enrolled TOTP account is routed through `/mfa` and completes its AAL2 challenge.
4. The Supabase verification query above reports all six operations tables.
5. An authenticated `GET /api/operations/safety` succeeds and reports Supabase-backed storage. A missing migration must surface as unavailable, never as a production local-file fallback.
6. System Health distinguishes configured, verified, and online services.
7. A paper-mode market scan completes, persists its evidence, and restores scanner settings after a second browser session.
8. Watchlist symbols, saved strategy blueprints, paper/live mode, and language restore for the same user on another browser profile. Supported Discord test copy follows the saved language.
9. On a paper account or controlled broker test account, pausing new entries blocks an entry and leaves existing protective sell/stop/OCO orders intact. Do not perform this check against an unmanaged live position.
10. Evidence JSON and portfolio CSV/JSON exports download without exposing credential fields.
11. The application has one scheduler owner and an always-on backend instance.
12. Live credentials and unattended order authority remain disabled until operations storage, risk settings, protective orders, and notification delivery are reviewed.

## Migration workflow

For each deployment that changes database expectations:

1. back up the Supabase project or create a branch suitable for migration testing;
2. review and apply additive SQL migrations in repository order;
3. run the table verification query and inspect RLS policies and grants;
4. deploy the backend and confirm operations storage reports `supabase`;
5. deploy the frontend and complete the paper-mode smoke checks;
6. enable live authority only after the Safety Center and protective-order checks pass.

Keep a dated record of the SQL files applied to each environment. The application does not currently run schema migrations automatically during web-service startup.

## Rollback

Keep the preceding application image and database migration record. Rolling back code does not automatically reverse Supabase schema changes. Prefer additive migrations and leave the operations tables in place when rolling back application code. Disable live order authority and pause new entries first, confirm broker-side protective orders remain active, then restore the last known application image only after confirming that its expected tables and columns remain available.
