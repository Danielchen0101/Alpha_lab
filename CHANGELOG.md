# Changelog

All notable AlphaLab changes are recorded here. The project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html), and this file uses the structure from [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

No unreleased changes are currently documented.

## [3.0.0] - 2026-07-14

AlphaLab 3.0 is a product-wide release. It replaces the previous collection of screens with a consistent bilingual research and execution workspace, expands the saved research pipeline, and tightens the distinction between configured, verified, paper, and live states.

### Added

- A complete public product site with platform, workflow, research, examples, data and methodology, security, company, legal, and authentication pages.
- A shared authenticated application shell with primary workspaces for Overview, Markets, Research, Strategies, Trade, and Settings.
- Responsive secondary navigation and route-aware workspace labels across 18 protected application routes.
- Editorial dashboards for the daily brief, activity history, system health, market scanner, symbol analysis, watchlists, research automation, candidate review, backtests, optimization, comparison, rankings, trade desk, portfolio, and connection settings.
- Dedicated market-scanner, fine-scan, and deeper-validation workbenches with saved progress and clear stage transitions.
- Pipeline coverage for admission decisions, deterministic entry plans, eligible execution, managed-position protection, and exit evidence.
- Runtime and contract tests for deployment, scanner v5, fine scan v4, deeper-validation risk controls, pipeline admission, background scheduling, entry-plan execution, and position protection.
- User-facing scan progress, research-funnel counts, decision distributions, audit evidence, and execution-state summaries.
- English and Simplified Chinese copy for both the public site and signed-in product.
- Curated light and dark themes, responsive typography, compact data tables, and mobile layouts.
- Supabase-backed authentication, user configuration, pipeline state, and protected application routing.

### Changed

- Reorganized navigation around the way a user moves from market observation to research, validation, strategy testing, and execution.
- Rebuilt charts, tables, metric ledgers, inputs, status pills, progress tracks, and empty states for consistent financial-data presentation.
- Reworked the market scanner into a deterministic ranked-research flow with investability filters and a separate AI review layer.
- Reworked research automation into a seven-stage workflow: Market Scanner, Fine Scan, Deeper Validation, Portfolio Admission, Entry Plan, Execution, and Position & Exit.
- Rebuilt backtest, parameter optimization, strategy comparison, and ranking screens around shared research context.
- Rebuilt trade and portfolio screens with clearer account, exposure, performance, position, and order controls.
- Moved user provider and broker credentials into authenticated settings backed by Supabase; browser code no longer expects broker secrets.
- Updated the frontend package version and backend status response to `3.0.0`.
- Updated the production image to Node.js 20 and a non-root Nginx runtime.
- Standardized the production backend on one Gunicorn worker with eight threads so the in-process scheduler has one authoritative owner.
- Rewrote environment templates, deployment guidance, contribution guidance, pull-request metadata, and release automation for the v3 architecture.

### Fixed

- Full-width chart rendering, clipped graph lines, inconsistent axes, and charts that required horizontal scrolling at common laptop widths.
- Overlapping watchlist actions, system-health status pills, search controls, portfolio actions, and narrow-screen data cells.
- Zero-value progress bars that previously appeared partially filled.
- Metric alignment, number typography, cramped labels, oversized page titles, and undersized supporting copy.
- Research and market loading states that could remain on “awaiting first sync” after data became available.
- Route and secondary-tab behavior across public, market, research, strategy, trade, and settings workspaces.
- Inconsistent status language that could present a configured service as connected or verified.
- Public-page mobile overflow, authentication-page spacing, and legal-page readability.

### Security

- Removed `unsafe-eval` from the deployed frontend Content Security Policy.
- Clarified service-role and browser-safe Supabase credential boundaries in example configuration.
- Added authentication guards for protected application routes and a Turnstile integration point for authentication flows.
- Optimized Supabase Row Level Security policies and grants for authenticated and service-role access.
- Added a security policy, CODEOWNERS coverage for high-risk surfaces, and dependency update configuration.
- Updated direct runtime clients to Axios 1.18.1 and React Router 6.30.4, and refreshed compatible transitive packages without using a forced breaking audit migration.

### Deployment

- Updated the Docker build and Nginx configuration for SPA fallback, API proxying, health checks, stdout/stderr logging, and non-root runtime directories.
- Added a repository `.dockerignore` to keep local secrets, dependencies, build outputs, and runtime state out of container context.
- Preserved separate frontend/backend deployment support for Cloudflare Pages and Render.
- Documented that Render free instances are not suitable for an unattended in-process schedule.

### Upgrade notes

- Install Node.js 20 or newer and Python 3.11 or newer.
- Copy the new frontend and backend environment examples; add the public Supabase URL and anonymous key to the frontend.
- Apply `backend/supabase_schema.sql` before enabling saved pipeline state or authenticated per-user configuration.
- Keep Supabase service-role, Fernet, Flask, and provider secrets on the server.
- Run a single web process when using the built-in scheduler. Multiple processes require moving scheduling to a dedicated worker with a distributed lock.
- Recheck Alpaca paper/live selection and every risk limit before enabling order submission.

### Validation

- Frontend Jest suite, ESLint, TypeScript checking, and production build.
- 26 frontend Jest tests and 117 backend pytest tests covering authentication, scanning, validation, admission, scheduling, execution, and position protection.
- Full frontend ESLint completed with no errors; five existing Hook dependency warnings remain in legacy pages outside this release's changed route set.
- Desktop and mobile review of public and authenticated routes.
- Browser route checks for all public and protected page entry points.

### Known limitations

- Live broker, market-data, AI-provider, and notification behavior requires user-supplied provider accounts and credentials.
- The built-in scheduler is process-local and must have a single authoritative process in production.
- Create React App 5 retains 25 npm audit findings in its legacy build, Jest/jsdom, SVG, and development-server dependency tree. The release does not apply npm's proposed forced `react-scripts@0.0.0` replacement; direct Axios and React Router findings were upgraded separately.
- The main browser bundle is about 927 kB compressed and remains a candidate for route-level code splitting.
- AlphaLab assists research and execution; it does not provide investment advice or guarantee strategy performance.

## [2.9.2] - 2026-06-16

Production status and configuration-state stability fixes.

## [2.9.1] - 2026-05-30

Research-pipeline reliability and backend behavior improvements.

## [2.9.0] - 2026-05-30

Theme and localization refinements across the existing product.

## [2.8.0] - 2026-05-27

Manual and scheduled pipeline behavior aligned around shared saved context.

## [2.7.7] - 2026-05-26

Maintenance release for the v2 research and execution workflow.

Earlier release history remains available through the repository's Git tags and compare view.

[Unreleased]: https://github.com/Danielchen0101/quant_platform/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/Danielchen0101/quant_platform/compare/v2.9.2...v3.0.0
[2.9.2]: https://github.com/Danielchen0101/quant_platform/compare/v2.9.1...v2.9.2
[2.9.1]: https://github.com/Danielchen0101/quant_platform/compare/v2.9.0...v2.9.1
[2.9.0]: https://github.com/Danielchen0101/quant_platform/compare/v2.8.0...v2.9.0
[2.8.0]: https://github.com/Danielchen0101/quant_platform/compare/v2.7.7...v2.8.0
[2.7.7]: https://github.com/Danielchen0101/quant_platform/releases/tag/v2.7.7
