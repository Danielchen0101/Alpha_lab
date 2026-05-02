# Changelog

All notable changes to the Professional Quantitative Trading Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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