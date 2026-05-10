<div align="center">

# Alpha Lab

### Quantitative Trading Platform

![Version](https://img.shields.io/badge/version-2.6.3-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Python](https://img.shields.io/badge/Python-3.8+-3776ab?style=flat-square&logo=python)
![Flask](https://img.shields.io/badge/Flask-2.0-black?style=flat-square&logo=flask)

AI-powered quantitative trading platform with multi-stage market scanning, AI-driven trade planning, and paper/live execution via Alpaca Markets.

</div>

---

## Overview

Alpha Lab is an end-to-end quantitative trading platform that combines market data, strategy research, AI reasoning, and execution planning into a single workflow. It supports paper trading and live trading through Alpaca Markets, with AI analysis powered by DeepSeek, OpenAI, Claude, and other LLM providers.

## Core Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | System overview with real-time market data and portfolio summary |
| **Market** | Real-time stock quotes, interactive candlestick charts, market scanner |
| **Backtest** | Strategy backtesting engine with 15+ performance metrics |
| **Parameter Optimization** | Genetic algorithm-based strategy parameter tuning |
| **Strategy Comparison** | Side-by-side strategy performance analysis |
| **Strategy Ranking** | Multi-criteria strategy ranking and scoring |
| **Trading Workspace** | Alpaca paper/live trading with order management |
| **Portfolio** | Account snapshot, positions, portfolio performance chart |
| **Configuration** | API key management and platform settings |

## AI Agent Pipeline

The AI Agent follows a multi-stage scanning and execution pipeline:

```
Market Scanner
    → Preferred Continue Scan List
        → Fine Scan
            → Deeper Validation
                → Entry Plan
                    → Exit Scan
```

**Automation Modes:**
- **AI Mode** — Fully automated: scan, plan, and execute without manual intervention
- **Semi-AI Mode** — AI generates plans, user confirms before execution
- **Manual Mode** — AI analysis only, no orders placed

**Key Capabilities:**
- Multi-stage market screening with configurable filters
- AI-generated entry plans with risk gates and position sizing
- Automatic GTC sell order placement via Exit Scan
- Duplicate order prevention and sellable quantity validation
- Bracket order support for take-profit and stop-loss management

## v2.6.3 Highlights

### Authentication & Security
- **Cloudflare Turnstile CAPTCHA** — Human verification on Create Account page; Sign In shows CAPTCHA after 3 failed attempts
- **Auth UX Refinements** — Optimized form validation, button disabled states, dark theme polish across Sign In / Sign Up
- **Google / GitHub OAuth** — Third-party login via Supabase OAuth providers
- **Apple OAuth** — Removed from active providers, marked as Coming Soon (avoids Azure tenant configuration issues)

### Legal & Compliance
- **Terms of Service Page** — `/terms` with 16-section bilingual legal content, deep-linkable from registration
- **Privacy Policy Page** — `/privacy` with 16-section bilingual privacy content, deep-linkable from registration
- **Email Confirmed Page** — `/auth/confirmed` — dedicated confirmation success page with clean dark UI

### CAPTCHA & Bot Protection
- Turnstile Site Key read from `REACT_APP_TURNSTILE_SITE_KEY` environment variable only
- Development mode: shows warning banner if key is missing, allows testing bypass
- Production mode: blocks registration if key is not configured
- Turnstile widget resets on submission error for retry

### Localization
- Landing Page full Chinese translation with language switch button in navigation
- Legal pages fully bilingual (English + Chinese)
- Continued locale refinements across auth, landing, and legal pages

### Email Configuration
- Email confirmation redirect now points to `/auth/confirmed`
- Documentation for Resend + Custom SMTP setup in Supabase
- Environment variable documentation for email and CAPTCHA configuration

## v2.6.2 Highlights

### Portfolio Page
- **Portfolio Chart Fixed** — Equity line now renders correctly with Y-axis scaled to actual portfolio value (fixed $0-$100 Y-axis bug in paper mode)
- **Fallback Chart Data** — When Alpaca history is empty, chart shows reference curve from current account equity instead of empty state
- **Global Trade Mode** — Portfolio page reads trade mode from sidebar context; standalone page-level switch removed
- **Chart UX Improvements** — Better X-axis labels, tooltip formatting, and Y-axis domain computation

### AI Agent
- **Auto-Pipeline Refinements** — AI/Semi-AI/Manual mode execution logic optimized for Entry Plan, Buy Order, Exit Scan, and GTC Sell Order flows
- **Fractional Shares** — Entry Plan and order execution support fractional quantities (e.g., 0.01, 0.1, 1.1 shares)
- **Leveraged ETF Awareness** — High Risk mode considers leveraged ETF alternatives (TSLL, TSLQ, NVDL) subject to Alpaca tradability check and risk controls

### Platform
- **Unified Trade Mode** — All Real/Paper Trading API calls follow global sidebar trade mode
- **Chinese Localization** — Continued refinement of Chinese translations and UI polish
- **Portfolio Chart Robustness** — NaN guards, data validation, and fallback generation prevent chart crashes

### Bug Fixes
- Fixed Portfolio chart Y-axis showing $0-$100 due to Recharts domain function type mismatch
- Fixed DecimalError: Invalid argument: NaN crash in Y-axis domain calculation
- Fixed backend datetime module shadowing causing Portfolio Performance "Network Error"
- Fixed Portfolio history empty-state fallback triggering logic

## v2.6.0 Highlights

### New Features
- **Fractional Shares Support** — Buy and sell fractional quantities (e.g., 0.1, 0.5, 1.1 shares) across all order paths
- **Full Chinese Localization** — AI Agent, Trading Workspace, Portfolio, Configuration pages fully translated
- **GTC Sell Orders** — Exit Scan now places Good-Till-Canceled sell orders instead of day orders
- **AI Mode Auto-Pipeline** — End-to-end automated flow from scanning to execution
- **Price-Aware Order Logic** — Automatic market vs. limit order selection based on current price vs. entry zone

### Improvements
- **Better Error Display** — Full Alpaca API error response body shown on order rejection
- **Entry Plan Button Fix** — Corrected verdict filtering and risk gate logic
- **Professional UI** — Enhanced status displays, risk indicators, and execution feedback
- **Position Sizing** — Backend calculations now support fractional share quantities

### Bug Fixes
- Fixed Exit Scan 422 error caused by invalid bracket order usage on sell orders
- Fixed Entry Plan button remaining disabled for valid candidates
- Fixed integer truncation on fractional position sizes

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Ant Design, Recharts, Lightweight Charts |
| Backend | Flask, Python 3.8+, Pandas, NumPy |
| Auth & Storage | Supabase (authentication, encrypted API key storage) |
| Trading | Alpaca Markets API (paper & live trading, market data) |
| Market Data | Finnhub API |
| AI Analysis | DeepSeek, OpenAI, Claude, NVIDIA NIM, Mimo |
| Deployment | Cloudflare Pages (frontend), Render (backend) |

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Cloudflare Pages | Auto-deployed from `main` branch |
| Backend | Render | Auto-deployed from `main` branch |

## Getting Started

### Prerequisites
- Node.js 16+
- Python 3.8+
- Supabase project (for auth and config storage)

### Backend

```bash
cd backend
pip install -r requirements.txt
# Configure .env (see .env.example)
python start_quant_backend.py
```

Backend runs on `http://localhost:8889`.

### Frontend

```bash
cd frontend
npm install
# Configure REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in frontend/.env
npm start
```

Frontend runs on `http://localhost:3000`.

### Production Build

```bash
cd frontend
npm run build
```

## Configuration

Configure the following APIs via the Settings page (stored encrypted in Supabase):

| API | Purpose |
|-----|---------|
| Supabase | Authentication and encrypted config storage |
| Alpaca Trading | Order execution (paper and live) |
| Alpaca Market Data | Real-time and historical price data |
| Finnhub | Market data and news |
| AI Provider | AI-powered analysis and trade recommendations |

**Never commit API keys.** All keys are stored encrypted in Supabase per-user. The frontend only displays masked values.

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_API_BASE_URL` | Yes | Backend API base URL (e.g. `http://127.0.0.1:8889/api`) |
| `REACT_APP_SUPABASE_URL` | Yes | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (safe for frontend) |
| `REACT_APP_TURNSTILE_SITE_KEY` | No* | Cloudflare Turnstile CAPTCHA site key — required for production registration |

*\* If unset, registration is blocked in production; development shows warning + bypass.*

### Supabase Configuration (Dashboard — not in `.env`)

| Setting | Value |
|---------|-------|
| **Turnstile Secret Key** | Configured in Supabase Auth → Bot and Abuse Protection (never in frontend) |
| **Resend / SMTP API Key** | Configured in Supabase Auth → Custom SMTP (never in repository) |
| **Redirect URLs** | Add `http://localhost:3000/auth/confirmed`, `http://localhost:3000/**` (dev) and `https://quant-platform.pages.dev/auth/confirmed`, `https://quant-platform.pages.dev/**` (production) |

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `FRONTEND_ORIGIN` | Yes | Allowed CORS origin (e.g. `http://localhost:3000`) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only — never in frontend) |
| `FERNET_KEY` | Yes | Key for encrypting user API credentials at rest |

**Never commit sensitive keys:** Turnstile Secret Key, Resend API Key, Supabase service role key, Alpaca API keys, or any other credentials. Use `.env.example` templates and never commit `.env` files.

## Security

- Supabase-authenticated login required for all protected routes
- Per-user Fernet-encrypted API key storage in Supabase
- Global 401 interceptor with automatic sign-out on session expiry
- Backend logs never expose API keys or secrets
- No fallback to environment variables for user-specific configuration
- Cloudflare Turnstile CAPTCHA protects registration and rate-limited sign-in
- All OAuth flows handled server-side by Supabase; no third-party tokens exposed to frontend

## Disclaimer

> **This platform is designed for research, education, and paper trading purposes.**
>
> - Nothing on this platform constitutes financial advice, investment recommendations, or solicitation to trade.
> - Paper trading results do not guarantee live trading performance.
> - Live trading involves real financial risk. Users are solely responsible for their trading decisions and any resulting gains or losses.
> - Always test thoroughly with paper trading before considering live execution.
> - The developers assume no liability for any financial losses incurred through use of this software.

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with React, Flask, and AI**

</div>
