# AlphaLab v1.9.7

![Version](https://img.shields.io/badge/version-1.9.7-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.8%2B-blue)
![React](https://img.shields.io/badge/react-18.2.0-blue)

AI-powered quantitative trading and stock analysis platform with paper/real trading support. Built with React/TypeScript frontend and Python/Flask backend.

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

## Showcase

> Screenshots will be added after the next UI capture.

<!-- 
![Dashboard](docs/showcase/dashboard.png)
![Market Scanner](docs/showcase/market-scanner.png)
![AI Agent](docs/showcase/ai-agent.png)
![Backtest](docs/showcase/backtest.png)
![Settings](docs/showcase/settings.png)
-->

## Configuration

Configure the following APIs in `.env` (copy from `.env.example`):

| API | Purpose | Base URL |
|-----|---------|----------|
| Alpaca Trading | Order execution | `https://paper-api.alpaca.markets` (paper) / `https://api.alpaca.markets` (real) |
| Alpaca Market Data | Price data | `https://data.alpaca.markets` |
| Finnhub | Market data & news | `https://finnhub.io/api/v1` |
| AI Provider | AI analysis (DeepSeek, OpenAI, etc.) | Configured in Settings page |

**Never commit real API keys.** Use `.env` for local config and `.env.example` as a template.

## Setup

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+ and pip

### Backend

```bash
cd backend
pip install -r requirements.txt
python start_quant_backend.py
```

Backend runs on `http://localhost:8889`.

### Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on `http://localhost:3000` and proxies API requests to the backend.

### Production Build

```bash
cd frontend
npm run build
```

## Safety Notes

- **Real trading mode must be used carefully.** Always test with paper trading first.
- **Add to Watchlist does not execute orders.** It only adds stocks to your monitoring list.
- **Entry Plan execution should respect risk gate.** Do not bypass risk checks.
- **No mock data should be used for production analysis.** Ensure all data comes from live APIs.

## Tech Stack

**Frontend:** React 18, TypeScript, Ant Design, Recharts, Lightweight Charts, Redux Toolkit, React Router

**Backend:** Flask, Flask-CORS, Requests, Pandas, NumPy, yfinance, Pytz

**Data Sources:** Alpaca Markets, Finnhub, Polygon.io

## Project Structure

```
Alpha_lab/
├── frontend/                    # React TypeScript Frontend
│   ├── src/
│   │   ├── pages/              # Page components (Dashboard, Market, Backtest, etc.)
│   │   ├── components/         # Reusable UI components
│   │   ├── services/           # API service layer
│   │   ├── store/              # Redux state management
│   │   ├── hooks/              # Custom React hooks
│   │   ├── utils/              # Utility functions
│   │   ├── locales/            # i18n translations
│   │   └── styles/             # Global styles
│   ├── public/                 # Static assets
│   └── package.json
├── backend/                     # Python Flask Backend
│   ├── start_quant_backend.py  # Main application entry point
│   ├── config.py               # Configuration management
│   ├── technical_indicators.py # Technical analysis calculations
│   ├── ai_provider_config.json # AI provider settings
│   └── requirements.txt        # Python dependencies
├── scripts/                     # Startup and utility scripts
├── docker/                      # Docker configuration
├── docs/                        # Documentation
└── .env.example                 # Environment variable template
```

## Roadmap

- Improve AI Agent reasoning chain
- Add more technical indicators
- Enhance portfolio risk analytics
- Add broker integration options

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## 中文说明

这个项目是一个 AI 辅助量化交易平台，用于市场扫描、股票分析、回测、策略优化、风险评估、AI 推荐、Entry Plan、Watchlist 和交易执行准备。

GitHub 仓库不会上传真实 API Key。真实 API Key 应该只放在本地 `.env` 文件中。

真实交易前应该先使用 paper trading 进行测试，并且设置风险控制。
