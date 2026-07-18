# AlphaLab Product Roadmap

Last reviewed: 2026-07-16

## Completed in the current release line

- Unified responsive navigation and bilingual public/authenticated workspaces
- Public security and methodology pages
- Supabase authentication, OAuth callbacks, password recovery, Turnstile integration points, and TOTP MFA
- Account-scoped language, Paper/Live mode, risk, horizon, authority, leverage, and automation preferences
- Authenticated Safety Center with durable pause/resume, readiness, audit, order, and notification records
- Deterministic Entry Plan requirement for real new entries and preservation of protective exits
- Cross-device watchlists, scanner settings, and saved strategy artifacts
- Evidence provenance, secret redaction, portfolio diagnostics, and CSV/JSON exports
- Bilingual Discord recommendation, order, risk, pipeline, and failure notifications
- Route-level code splitting and top-level render recovery
- CI unit, lint, TypeScript, build, Playwright, dependency, Docker, and release-tree secret checks
- 59 frontend tests, 241 backend tests, and 12 Playwright checks

## Next architecture milestones

These are not release blockers, but they are the next meaningful improvements:

1. **Dedicated scheduler and position-guard worker**
   Move unattended scheduling and guard reconciliation out of the web process, with distributed ownership and durable heartbeats. This enables safe horizontal web scaling.

2. **Frontend build-stack migration**
   Replace Create React App with a maintained build stack, then remove the remaining low/moderate legacy transitive advisories and improve chunk-level control.

3. **Production observability destination**
   Connect sanitized Web Vitals, backend request IDs, structured audit events, uptime checks, and resource alerts to a monitored telemetry service with alert thresholds and retention.

4. **Historical secret remediation**
   Rotate any credential previously committed and coordinate a Git history rewrite only if all collaborators and deployments can safely re-clone.

5. **Disaster-recovery drill**
   Test Supabase restore, Render redeploy, secret rotation, scheduler recovery, broker reconciliation, and Safety Center state recovery as a documented exercise.

6. **OpenAPI and integration contract**
   Publish a generated API contract for supported backend routes and use it for typed client generation and compatibility checks.

## Release gate

Before every production release:

- all automated suites pass;
- Supabase advisors have no unaccepted security warning;
- Render and Cloudflare configurations match [DEPLOYMENT.md](../DEPLOYMENT.md);
- Paper scan and authentication smoke tests pass on the deployed origin;
- Live mode remains locked until MFA, broker verification, risk settings, Safety Center readiness, and protective-order behavior are manually confirmed.
