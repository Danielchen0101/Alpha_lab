# AlphaLab v2.5.0

![Version](https://img.shields.io/badge/version-2.5.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.8%2B-blue)
![React](https://img.shields.io/badge/react-18-blue)

AI-powered quantitative trading and stock analysis platform with paper/real trading support. Built with React/TypeScript frontend and Python/Flask backend, authenticated via Supabase.

## Overview

Alpha Lab is an AI-assisted quantitative trading and market analysis platform. It helps users scan the market, analyze stocks, run backtests, optimize strategies, evaluate risk, generate AI-supported trade plans, and prepare paper or real trading execution workflows.

The platform is designed for traders, students, and developers who want to combine market data, strategy research, AI reasoning, and execution planning in one workflow.

## Features

- **Dashboard** - System overview with real-time market data
- **Market** - Real-time stock quotes, interactive charts, and market scanner
- **Watchlist** - Track and monitor stocks of interest
- **Backtest** - Strategy backtesting with 15+ performance metrics
- **Parameter Optimization** - Genetic algorithm for strategy parameter tuning
- **Strategy Comparison** - Side-by-side strategy performance comparison
- **Strategy Ranking** - Rank strategies by multiple criteria
- **Local Paper Trading** - Risk-free trading simulation
- **Analytics** - Portfolio-level performance analytics
- **Alpaca Trade** - Paper and real trading via Alpaca Markets API
- **AI Agent** - AI-powered market scanning, analysis, and trade execution
- **AI Watchlist** - AI-driven stock screening and watchlist management
- **Settings / Configuration** - API key management and platform configuration

## AI Agent Workflow

The AI Agent follows a multi-stage workflow:

1. **Market Scanner** - Broad market screening for potential candidates
2. **Preferred Continue Scan List** - Filter and prioritize scanning candidates
3. **Fine Scan** - Detailed analysis of shortlisted stocks
4. **Deeper Validation** - Multi-factor validation including technicals and fundamentals
5. **Entry Plan** - Generate entry plans with risk gates and position sizing
6. **AI Watchlist** - Add validated stocks to AI-managed watchlist
7. **Paper / Real Trading Mode** - Execute trades in paper or live mode

## Tech Stack

**Frontend:** React 18, TypeScript, Ant Design, Recharts, Lightweight Charts, React Router

**Backend:** Flask, Flask-CORS, Requests, Pandas, NumPy, yfinance, Pytz

**Auth:** Supabase Auth (email/password), per-user encrypted config storage

**Data Sources:** Alpaca Markets, Finnhub

## Configuration

Configure the following APIs in `.env` (copy from `.env.example`):

| API | Purpose | Base URL |
|-----|---------|----------|
| Supabase | Auth & config storage | `https://<project>.supabase.co` |
| Alpaca Trading | Order execution | `https://paper-api.alpaca.markets` (paper) / `https://api.alpaca.markets` (real) |
| Alpaca Market Data | Price data | `https://data.alpaca.markets` |
| Finnhub | Market data & news | `https://finnhub.io/api/v1` |
| AI Provider | AI analysis (DeepSeek, OpenAI, Claude, NVIDIA NIM, etc.) | Configured in Settings page |

**Never commit real API keys.** Use `.env` for local config and `.env.example` as a template.

## Security

v2.1.0 introduces significant security hardening:

- **Supabase-authenticated login required** for all protected routes. No localStorage-based auth bypass.
- **Remember my email only** - the login page can prefill your email, but never auto-logs in. Password is always required.
- **Per-user encrypted config storage** - API keys and secrets are Fernet-encrypted in Supabase (`enc:` prefix). Backend decrypts on read; frontend only receives masked values.
- **Masked key detection** - if a masked value (containing `****`) is detected in the stored AI provider key, the UI warns the user to re-enter the real key.
- **Global 401 handling** - expired or invalid sessions are caught by a response interceptor that signs out and redirects to `/signin`.
- **No fallback policy** for AI Agent and Market Scanner - all data must come from user-saved Supabase config, not environment variables or global defaults.
- **Safe logging** - backend logs use `hasKey=True/False` and `maskedKey=...` instead of printing API key prefixes or secrets.
- **Alpaca Market Data auto-sync** - Market Data credentials are synced from Real Trading keys on save, with base URL always forced to `data.alpaca.markets`.

## Setup

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+ and pip
- Supabase project (for auth and config storage)

### Backend

```bash
cd backend
pip install -r requirements.txt
# Set environment variables in .env (see .env.example)
python start_quant_backend.py
```

Backend runs on `http://localhost:8889`.

### Frontend

```bash
cd frontend
npm install
# Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in frontend/.env
npm start
```

Frontend runs on `http://localhost:3000` and proxies API requests to the backend.

### Production Build

```bash
cd frontend
npm run build
```

## Project Structure

```
Alpha_lab/
├── frontend/                    # React TypeScript Frontend
│   ├── src/
│   │   ├── pages/              # Page components (Dashboard, Market, Backtest, etc.)
│   │   ├── components/         # Reusable UI components
│   │   ├── services/           # API service layer
│   │   ├── contexts/           # React contexts (Auth, Language)
│   │   ├── lib/                # Supabase client
│   │   ├── hooks/              # Custom React hooks
│   │   ├── utils/              # Utility functions
│   │   ├── locales/            # i18n translations
│   │   └── styles/             # Global styles
│   ├── public/                 # Static assets
│   └── package.json
├── backend/                     # Python Flask Backend
│   ├── start_quant_backend.py  # Main application entry point
│   ├── requirements.txt        # Python dependencies
│   └── .env.example            # Backend env template
├── .env.example                 # Root env template
├── CHANGELOG.md                 # Release history
└── README.md                    # This file
```

## Safety Notes

- **Real trading mode must be used carefully.** Always test with paper trading first.
- **Add to Watchlist does not execute orders.** It only adds stocks to your monitoring list.
- **Entry Plan execution should respect risk gate.** Do not bypass risk checks.
- **No mock data should be used for production analysis.** Ensure all data comes from live APIs.
- **All protected routes require Supabase login.** Unauthenticated users are redirected to `/signin`.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## 中文说明

这个项目是一个 AI 辅助量化交易平台，用于市场扫描、股票分析、回测、策略优化、风险评估、AI 推荐、Entry Plan、Watchlist 和交易执行准备。

v2.1.0 加强了安全性：所有受保护页面必须通过 Supabase 登录，API 密钥使用 Fernet 加密存储，前端只显示脱敏后的 key，日志不打印真实密钥。

GitHub 仓库不会上传真实 API Key。真实 API Key 应该只放在本地 `.env` 文件中。

真实交易前应该先使用 paper trading 进行测试，并且设置风险控制。
