# AlphaLab v3 Architecture and Integration Report

Last reviewed: 2026-07-16

## Product boundary

AlphaLab is a bilingual quantitative-research and execution workspace. It connects market discovery, deterministic validation, strategy testing, portfolio-aware planning, reviewed execution, and position protection. AI may summarize or challenge evidence, but it cannot bypass data-quality, risk, duplicate-order, admission, or broker controls.

AlphaLab does not provide investment advice or guarantee results.

## Runtime architecture

| Layer | Current implementation |
| --- | --- |
| Frontend | React 18, TypeScript, React Router, Ant Design, Redux Toolkit, Axios, ECharts/Recharts |
| Backend | Flask, Python, Gunicorn, bounded background work, one scheduler owner |
| Identity and durable state | Supabase Auth and Postgres with owner-scoped RLS |
| Market and brokerage | Alpaca plus optional Finnhub/provider enrichment |
| AI review | User-configured providers; deterministic gates retain authority |
| Hosting | Cloudflare Pages frontend and Render backend, or the repository Docker image |

The production backend uses one Gunicorn worker with four threads on the documented Render Pro profile. The scheduler, reconciliation loop, and managed-position guard are in-process and must not be duplicated across web workers.

## Main workflow

```text
Market Scanner
  → Fine Scan
  → Deeper Validation
  → Portfolio Admission
  → Entry Plan
  → Execution
  → Position & Exit
```

Paper and Live are separate account-scoped modes. New accounts begin in Paper. An explicit mode, language, risk profile, time horizon, AI authority, leverage choice, and automation configuration are restored for the same account across sessions and devices.

## Durable data

Apply these files in order:

1. `backend/supabase_schema.sql`
2. `backend/supabase_operations_store.sql`
3. `backend/supabase_security_hardening.sql`

The resulting database stores encrypted provider configuration, workspace preferences, scheduler state, run history, Safety Center state, readiness checks, operational audit events, order lifecycle, notification delivery, and versioned user artifacts.

Authenticated browser sessions can read only their own protected rows. Browser roles cannot directly insert, update, or delete these records; validated mutations go through the backend service role.

## Safety model

- Real new-entry execution fails closed when durable Safety Center state cannot be read.
- A generic real BUY cannot bypass the Entry Plan workflow.
- Pausing new entries may cancel pending AlphaLab-managed entry BUY orders, but preserves protective SELL, stop, and OCO orders.
- High-risk changes and real execution paths enforce the current authentication assurance requirements.
- Hard account, position, loss, order-size, and daily-order limits remain authoritative regardless of AI mode.
- Safety and artifact updates use versions so a stale page cannot silently overwrite newer state.

## User-facing operations

- Safety Center with pause/resume, readiness, order history, delivery history, and audit context
- TOTP MFA enrollment and AAL2 challenge
- Evidence drawer with provenance, recursive secret redaction, and JSON export
- Portfolio exposure, concentration, cash, drawdown, unrealized P/L, CSV and audit JSON export
- Cross-device watchlists, scanner settings, and saved strategy blueprints
- Bilingual Discord recommendation, BUY/SELL, pipeline, risk, and blocked-action messages
- Route-level lazy loading, top-level error recovery, mobile auth checks, and accessibility smoke tests

## Release validation baseline

- 59 frontend unit tests
- 241 backend tests
- 12 Chromium Playwright smoke/accessibility tests
- TypeScript check passes
- ESLint passes with zero warnings
- Production frontend build passes
- Python dependency audit reports no known vulnerability
- Frontend CI rejects high/critical dependency findings
- Release-tree secret scan passes

## External production configuration

Code cannot replace these dashboard-level checks:

- enable Supabase leaked-password protection, CAPTCHA, required OAuth providers, correct Site URL/redirect allow list, and production SMTP;
- use exact Google/GitHub callback `https://<project-ref>.supabase.co/auth/v1/callback`;
- keep Cloudflare Pages on `npm ci && npm run build` with the intended production variables;
- keep Render always-on, single-instance/single-worker, and supply every required production secret;
- rotate any credential ever exposed in Git history before release;
- verify Paper scan, MFA, Live readiness, Safety Center, protective exits, exports, and bilingual notifications after deployment.

For exact commands and environment variables, use [DEPLOYMENT.md](../DEPLOYMENT.md). For local setup and troubleshooting, use [QUICK_START.md](QUICK_START.md) and [FIX_GUIDE.md](FIX_GUIDE.md).
