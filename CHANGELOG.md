# Changelog

All notable changes to the Professional Quantitative Trading Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.5] - 2026-05-26

### Added
- Settings page status error subtype resolution: `session_unavailable`, `unauthorized`, `backend_unreachable`, `schema_migration`, `service_error`
- Settings status waits for Supabase session/token before making requests
- `hadAuthHeader` guard in Settings API 401 interceptor — only sign out when a real auth token was sent

### Fixed
- Settings page showing "Status unavailable" for all non-connected states — now shows specific error messages
- 401 response without auth header no longer triggers sign out (prevented page load during session initialization)

### Security
- API key status display uses masked values (`paper_api_key_masked`) instead of raw keys

## [2.7.4] - 2026-05-26

### Added
- Frontend auto-trigger: when "Next auto run" is due, `runAIPipeline` (same handler as Run Pipeline button) is invoked automatically
- Backend scheduler `last_backend_scan_at` / `last_backend_decision` tracking — separate from frontend `last_run_at`/`next_run_at`
- `autoRunTriggeredRef` lock prevents duplicate triggers for the same `nextAutoRunAt` window

### Changed
- Backend scheduler due check now uses `last_backend_scan_at` (not `last_run_at`) so its own headless scan tracking doesn't interfere with frontend `shouldRunNow` detection
- Backend skipped paths (market-closed, weekend, not-due) write `last_backend_decision` instead of `last_decision`, and no longer overwrite `next_run_at` — preventing "next run jumped forward without scanning"
- Backend `_pa_save_config` restored after headless pipeline run (was accidentally removed)
- Status endpoint `shouldRunNow` remains based on `last_run_at` (frontend-only), unchanged

### Fixed
- Market Auto Run due time arriving would only advance `nextRunAt` to the next interval without triggering a real scan
- Backend pipeline-run path did not persist scan results (`_pa_save_config` missing)
- Frontend auto-trigger `useEffect` was replaced with a no-op (only resetting `autoRunTriggeredRef`)
- Headless backend scan `reason` line referenced undefined `last_run_at` variable (NameError)
- Scheduler skipped path updating `next_run_at` caused UI to show advanced time without a scan

### Security
- Discord webhook URL validation checks use URL patterns, never log actual webhook URLs

## [2.6.3] - 2026-05-10

### Added
- Cloudflare Turnstile human verification (CAPTCHA) on Create Account registration page
- CAPTCHA appears on Sign In after 3 failed login attempts
- CAPTCHA site key missing detection: dev shows warning + bypass, production blocks registration
- Google / GitHub OAuth login buttons on Sign In and Sign Up pages
- Terms of Service page (`/terms`) with full 16-section bilingual (EN/ZH) legal content
- Privacy Policy page (`/privacy`) with full 16-section bilingual privacy content
- Email confirmation success page (`/auth/confirmed`) — dedicated dark-theme landing page after email verification
- `emailRedirectTo` parameter passed to Supabase signUp — redirects to `/auth/confirmed`
- Locale keys for legal pages, auth confirmed page, and CAPTCHA messages
- Chinese/English translation support for all new pages

### Changed
- Sign In / Sign Up CAPTCHA widget now uses bound turnstile object for reset (replaces ref pattern)
- Sign In CAPTCHA hidden on initial load; only renders after 3 failed login attempts
- Sign Up Terms of Service and Privacy Policy links now use React Router `Link` with `e.stopPropagation()`
- Sign Up checkbox links navigate to `/terms` and `/privacy` instead of `preventDefault`
- README updated with v2.6.3 highlights and Environment Variables section
- CHANGELOG updated with v2.6.3 entry
- Version bumped from 2.6.2 to 2.6.3

### Fixed
- Create Account button permanently disabled when `REACT_APP_TURNSTILE_SITE_KEY` not configured
- Sign In CAPTCHA always showing on page load (now shown after 3 failed attempts only)
- TypeScript error: `Turnstile` used as type instead of `typeof Turnstile` in SignUp/SignIn
- TypeScript error: `HTMLLinkElement` cast fixed to `HTMLAnchorElement` in Terms/Privacy pages
- Unused `Typography` imports cleaned from Terms/Privacy pages
- Turnstile widget ref incompatibility with react-turnstile (uses `BoundTurnstileObject` callbacks instead)

### Security
- Turnstile Secret Key managed server-side via Supabase Bot and Abuse Protection (never in frontend)
- Resend / SMTP API key configured in Supabase Dashboard, not in repository
- `.env` files excluded from version control; only `.env.example` committed
- Environment Variables section documents which keys are safe for frontend vs. server-only

## [2.6.2] - 2026-05-10

### Added
- Portfolio page fallback chart generation when Alpaca history is empty but account equity exists
- Fallback chart indicator showing "Reference curve generated from current account equity"
- Chinese/English translations for fallback chart note

### Changed
- Portfolio page uses global Trade Mode from sidebar context instead of standalone page-level switch
- Trading mode displayed as read-only Tag badge (Paper/Real) on Portfolio page
- Portfolio chart simplified to single equity line (removed dual Y-axis profit/loss line)
- Portfolio chart X-axis formatting improved with range-specific date/time formats
- Portfolio chart tooltip enhanced with localized time display
- AI Agent pipeline execution logic optimized for AI/Semi-AI/Manual modes
- AI Mode supports automated Entry Plan → Buy Order → Exit Scan → GTC Sell Order flow
- Entry Plan supports fractional shares (e.g., 0.01, 0.1, 1.1 shares)
- Real/Paper Trading API calls unified to follow global trade mode
- Chinese translations and UI display refinements

### Fixed
- Portfolio chart Y-axis showing $0-$100 instead of actual account equity range (paper mode)
- Portfolio chart Y-axis domain NaN crash (DecimalError: Invalid argument: NaN)
- Portfolio Performance "Network Error" caused by backend `datetime` module shadowing
- Portfolio chart now shows fallback flat line instead of "No portfolio history" when history API returns empty
- YAxis domain pre-computed from actual equity data instead of using Recharts inline function
- Portfolio history data validation: filters out invalid equity values (non-finite, <= 0)

## [2.6.0] - 2026-05-09

### Added
- Fractional shares support across all order paths (buy, sell, auto-execute)
- Full Chinese localization for AI Agent, Trading Workspace, Portfolio, and Configuration pages
- GTC (Good-Till-Canceled) time_in_force for Exit Scan sell orders
- Price-aware order type selection: automatic market vs. limit based on current price vs. entry zone
- AI Mode end-to-end auto-pipeline: Market Scanner → Entry Plan → Auto-Execute → Exit Scan
- Detailed Alpaca API error response display on order rejection
- Duplicate sell order prevention in Exit Scan
- Sellable quantity validation before order submission
- i18n translation system with 160+ new Chinese locale keys

### Changed
- Exit Scan sell orders use simple limit/market instead of bracket orders (bracket is buy-side only on Alpaca)
- Execution candidates shares input now accepts decimal values (step=0.01, min=0.0001)
- Order modal quantity input supports fractional shares
- Backend position sizing calculations now preserve decimal precision
- Backend `ai_execution_order` no longer truncates qty to integer

### Fixed
- Entry Plan button remaining disabled for valid candidates with verdict "Pass"
- Risk gate BLOCK incorrectly blocking Entry Plan generation (now only blocks execution)
- Exit Scan 422 Alpaca API error caused by invalid bracket order on sell orders
- Integer truncation on fractional position sizes in backend calculations

## [2.5.0] - 2026-05-06

### Added
- AI Agent page full Chinese localization
- Alpaca Trade mode: Paper Trading / Real Trading toggle
- Alpaca-sourced Portfolio Performance chart
- Rich New Order modal with Alpaca order options (limit, stop, stop-limit, trailing stop)
- Position Sell button for quick exit
- AI Entry Watchlist Buy button for direct order placement
- AI Execution order submission integration with Alpaca API
- CI fixes: Node 20 upgrade, npm ci, backend lint

### Changed
- AI Execution section moved above AI Watchlist for improved workflow
- ESLint cleanup: 235 warnings reduced to 20 hook warnings (react-hooks/exhaustive-deps only)

### Fixed
- Alpaca stale encrypted credential validation

## [2.2.0] - 2026-05-02

### Changed
- User API keys (Alpaca, Finnhub, AI Provider) now come **only** from Settings / Configuration database records
- Removed local `.env` fallback for all user API keys in `resolve_alpaca_config`, `resolve_finnhub_config`, `resolve_ai_config`
- `alpaca_config_state` no longer initializes from `ALPACA_API_KEY` / `ALPACA_API_SECRET` env vars
- Old `/api/config/alpaca` and `/api/config/finnhub` routes now read/write Supabase instead of JSON files
- `/api/config/alpaca/test` requires authentication and reads keys from database
- Paper/Real Trading Test buttons now use authenticated API calls (`userApi`)
- `_load_all_configs` no longer loads API keys from local JSON files
- Cleaned `.env.example` files: removed user API key placeholders, added note that keys are configured via Settings page
- Removed `ALPACA_API_KEY`, `ALPACA_API_SECRET`, `FINNHUB_API_KEY` imports from `config.py`

### Security
- No user API key falls back to local `.env` — all keys stored encrypted in Supabase `user_api_configs` per `user_id`
- Test Connection reads decrypted keys from database, never from masked frontend inputs or `.env`

## [2.1.0] - 2026-05-01

### Added
- Supabase-authenticated login required for all protected routes
- Global 401 response interceptor: expired sessions auto-sign-out and redirect to /signin
- Masked key detection for AI Provider: warns when stored key contains `****`
- `keyIsMasked` field in `/api/config/status` response
- Specific error message for masked keys in AI analysis endpoints
- Remember my email: saves email to localStorage on login, prefills on page load (never saves password, never auto-logs in)
- Alpaca Market Data auto-sync from Real Trading credentials on save
- Provider-specific API test handling (Claude `/messages`, Gemini `generateContent`, OpenAI-compatible)
- NVIDIA NIM, Mimo, Custom provider support in Settings UI
- Per-user encrypted config storage via Supabase (Fernet `enc:` prefix)

### Changed
- AI Provider / Market Scanner no-fallback policy: all config must come from user-saved Supabase data
- Market Data base URL always forced to `data.alpaca.markets`
- `aiTestStatus` only resets when API key actually changes (not on every save)
- Backend logs use `hasKey=True/False` and `maskedKey=...` instead of printing key prefixes
- Removed NVIDIA-specific rate limiting from non-NVIDIA providers
- `ai_chat_request()` now accepts `provider` parameter for provider-aware rate limiting
- Login page checkbox label changed from "Remember me" to "Remember my email"

### Fixed
- `authSlice.ts` no longer sets `isAuthenticated` from localStorage token (was a critical auth bypass)
- Missing `useRef` declarations in Portfolio.tsx (`stopRequestedRef`, `marketScannerStopRequestedRef`, `marketScannerIsScanningRef`)
- Removed hardcoded Supabase service role key from backend source
- Removed 11 `print()` calls that leaked API key prefixes (6-10 chars) in backend logs
- Removed debug `console.log` for session/token presence in Configuration.tsx and api.ts
- Removed `apiKeyPreview`/`apiSecretPreview` from debug endpoint (replaced with boolean `hasApiKey`/`hasApiSecret`)
- Scanner now returns `None` instead of `0` for failed price/volume data

### Security
- All protected routes require verified Supabase session (no localStorage bypass)
- API keys/secrets Fernet-encrypted in Supabase, only masked values returned to frontend
- Global 401 interceptor on both `api` and `scannerApi` axios instances
- Backend never logs full or partial API keys/secrets
- `.env` and config JSON files excluded via `.gitignore`
- No hardcoded credentials in source code

## [1.7.3] - 2026-04-16

### Added
- Real Market Scanner diagnostic testing scripts
- Comprehensive limit point audit report
- Real backend log analysis tools
- Direct AI analysis endpoint testing
- Version 1.7.3 backup with complete project state

### Changed
- Updated diagnostic methodology from code analysis to real runtime verification
- Improved error logging for DeepSeek API failures
- Enhanced backend monitoring with real-time log capture

### Fixed
- Identified root cause of empty AI fields: DeepSeek API key invalid (HTTP 401)
- Discovered news data using mock fallback instead of real Finnhub API
- Documented transparent error handling issue (success: true with null AI fields)

### Security
- No sensitive data exposed in logs (API keys truncated)
- All diagnostic tests performed locally

## [1.7.0] - 2026-04-12

### Added
- Market scanner feature for real-time stock screening
- AI trading signals module with machine learning recommendations
- Parameter optimization using genetic algorithms
- Portfolio management with paper trading simulation
- Strategy comparison interface for multiple backtest results
- Interactive candlestick charts with multiple timeframes
- Professional documentation and project templates
- Version mapping system for all backup directories

### Changed
- Optimized batch requests for market data (45% reduction in HTTP calls)
- Implemented intelligent caching system for profile data (24-hour TTL)
- Enhanced frontend performance with skeleton screens
- Improved error handling and user feedback
- Updated API documentation and examples
- Updated project version from 1.0.0 to 1.7.0

### Fixed
- Resolved 1D chart data issue on non-trading days
- Fixed market data caching inconsistencies
- Corrected backtest engine calculation errors
- Addressed timezone handling issues in historical data
- Fixed API response formatting problems

## [1.0.0] - 2026-04-12

### Added
- Initial release of Professional Quantitative Trading Platform
- Complete frontend-backend separation architecture
- Real-time market data from multiple sources (Finnhub, Alpaca, Yahoo Finance)
- Backtesting engine with 15+ financial metrics
- User authentication and session management
- Responsive design for desktop and mobile devices
- Comprehensive API documentation
- Startup scripts for Windows environment

### Technical Features
- React 18 with TypeScript frontend
- Flask Python backend with RESTful API
- Ant Design UI components
- Recharts and Lightweight Charts for data visualization
- Concurrent data fetching with thread pools
- Intelligent request batching and caching

## [0.9.0] - 2026-03-21

### Added
- Dashboard with system overview and market statistics
- Market data page with real-time stock quotes
- Symbol analysis with technical indicators
- Backtesting interface with strategy configuration
- Strategy ranking based on performance metrics
- Watchlist for favorite stock symbols
- Backtest history and detailed results view

### Changed
- Optimized Finnhub API usage with batch requests
- Implemented profile data caching for 24 hours
- Enhanced frontend loading states with skeleton screens
- Improved error handling and user notifications
- Updated documentation with detailed setup instructions

### Fixed
- Resolved 1-week chart data gaps
- Fixed X-axis labeling on historical charts
- Corrected weekend data filtering issues
- Addressed API timeout and rate limiting problems
- Fixed frontend routing and navigation issues

## [0.8.0] - 2026-03-10

### Added
- Basic backtesting engine with moving average strategy
- Performance metrics calculation (Sharpe ratio, max drawdown, etc.)
- Historical data integration with Twelve Data API
- User interface for backtest configuration
- Results visualization with equity curves
- Export functionality for backtest results

### Changed
- Restructured project for better maintainability
- Separated frontend and backend concerns
- Improved API response formatting
- Enhanced error handling and logging
- Updated dependencies to latest versions

### Fixed
- Resolved CORS issues between frontend and backend
- Fixed data parsing errors from external APIs
- Corrected calculation errors in performance metrics
- Addressed timezone inconsistencies
- Fixed frontend build and deployment issues

## [0.7.0] - 2026-03-01

### Added
- Initial project structure and setup
- Basic Flask backend with REST API
- React frontend with Ant Design components
- Market data integration with Finnhub API
- User authentication framework
- Basic charting capabilities

### Technical Foundation
- Python 3.8+ backend environment
- Node.js 16+ frontend environment
- TypeScript for type-safe frontend development
- Git for version control
- Comprehensive documentation

---

## Deprecated Features
- None currently

## Security Updates
- Regular dependency updates for security patches
- Input validation and sanitization
- Secure authentication token handling
- HTTPS enforcement in production
- Content Security Policy implementation

## Performance Improvements
- Batch request optimization (45% reduction)
- Intelligent caching system
- Concurrent data fetching
- Frontend code splitting and lazy loading
- Database query optimization
- Image and asset compression

---

## Migration Guides

### Upgrading from v0.8.0 to v1.0.0
1. Update all dependencies: `npm install` and `pip install -r requirements.txt`
2. Review breaking changes in API endpoints
3. Update environment configuration with new API keys
4. Test all major user flows after upgrade

### Upgrading from v0.7.0 to v0.8.0
1. Install new dependencies for backtesting features
2. Update database schema if applicable
3. Migrate configuration files to new format
4. Test backtesting functionality thoroughly

---

## Contributing to this Changelog

We welcome contributions to keep this changelog accurate and helpful. Please follow these guidelines:

1. Use the existing format and structure
2. Group changes under appropriate headings (Added, Changed, Fixed, etc.)
3. Include relevant issue or PR references
4. Use clear, concise language
5. Focus on user-facing changes and technical improvements

For more details, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

*This changelog was automatically generated based on git commit history and project documentation.*