# Professional Quantitative Trading Platform

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.8%2B-blue)
![React](https://img.shields.io/badge/react-18.2.0-blue)
![TypeScript](https://img.shields.io/badge/typescript-4.9.5-blue)

A modern, full-featured quantitative trading platform with real-time market data, backtesting engine, AI-powered trading signals, and portfolio management. Built with React/TypeScript frontend and Python/Flask backend.

## ✨ Features

### 📈 Market Data & Analysis
- **Real-time Stock Quotes**: Multiple data sources (Finnhub, Alpaca, Yahoo Finance)
- **Interactive Charts**: Candlestick charts with multiple timeframes (1D, 1W, 1M, 1Y)
- **Symbol Analysis**: Detailed technical analysis for individual stocks
- **Market Scanner**: Real-time screening and filtering of stocks
- **Portfolio Tracking**: Monitor positions and performance

### 🤖 AI Trading & Signals
- **AI Trading Signals**: Machine learning based buy/sell recommendations
- **Parameter Optimization**: Genetic algorithm for strategy optimization
- **Backtest Automation**: Automated strategy testing with historical data
- **Risk Management**: AI-powered risk assessment and position sizing

### 🔧 Backtesting Engine
- **15+ Performance Metrics**: Sharpe ratio, Sortino ratio, max drawdown, win rate, etc.
- **Multiple Strategies**: Support for moving average, RSI, MACD, and custom strategies
- **Strategy Comparison**: Side-by-side comparison of multiple strategies
- **Historical Analysis**: Detailed backtest history and performance ranking

### 📊 Portfolio Management
- **Paper Trading**: Risk-free trading simulation
- **Position Management**: Track buys, sells, and current holdings
- **Performance Analytics**: Portfolio-level metrics and visualization
- **Risk Analysis**: Exposure analysis and risk metrics

### ⚡ Performance Optimizations
- **Batch Request Optimization**: Reduced HTTP requests by 45%
- **Intelligent Caching**: 24-hour profile data caching
- **Concurrent Processing**: Thread pool for parallel data fetching
- **Skeleton Screens**: Immediate UI feedback during data loading

## 🏗️ Architecture

```
professional_quant_platform/
├── frontend/                 # React TypeScript Frontend
│   ├── src/pages/           # Page Components
│   │   ├── Dashboard.tsx    # System Overview
│   │   ├── Market.tsx       # Market Data
│   │   ├── SymbolAnalysis.tsx # Technical Analysis
│   │   ├── Backtest.tsx     # Backtesting Interface
│   │   ├── AITrading.tsx    # AI Trading Signals
│   │   ├── Portfolio.tsx    # Portfolio Management
│   │   ├── StrategyComparison.tsx # Strategy Comparison
│   │   └── ParameterOptimization.jsx # Strategy Optimization
│   ├── src/services/        # API Services
│   │   ├── marketDataService.ts # Market Data
│   │   ├── backtestService.ts   # Backtest Engine
│   │   └── aiTradingService.ts  # AI Trading
│   └── src/components/      # Reusable Components
├── backend/                 # Python Flask Backend
│   ├── start_quant_backend.py # Main Application
│   ├── config.py           # Configuration
│   └── *.py               # Various modules and utilities
├── docs/                   # Documentation
├── scripts/               # Startup Scripts
└── backups/              # Version backups
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 16+** and **npm** for frontend
- **Python 3.8+** and **pip** for backend
- **Git** for version control

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/quant-trading-platform.git
cd quant-trading-platform
```

2. **Backend Setup**
```bash
cd backend
# Install Python dependencies
pip install flask flask-cors requests pandas numpy yfinance pytz
# Start the backend server
python start_quant_backend.py
```
Backend runs on http://localhost:8889

3. **Frontend Setup**
```bash
cd frontend
npm install
npm start
```
Frontend runs on http://localhost:3000

4. **Using Startup Scripts (Windows)**
```bash
# Start backend
scripts\start_backend.bat
# Start frontend
scripts\start_frontend.bat
# Or start both
scripts\start_platform.bat
```

### Environment Configuration

Copy `.env.example` to `.env` and configure your API keys:

```env
# Data Source Configuration
FINNHUB_API_KEY=your_finnhub_api_key
ALPACA_API_KEY=your_alpaca_api_key
ALPACA_SECRET_KEY=your_alpaca_secret_key
ALPACA_PAPER_API_KEY=your_alpaca_paper_key
ALPACA_PAPER_SECRET_KEY=your_alpaca_paper_secret

# Application Configuration
FLASK_ENV=development
JWT_SECRET_KEY=your-secret-key-here
```

## 📡 API Documentation

### Market Data Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/market/stocks` | GET | Get real-time stock data (batch optimized) |
| `/api/market/stock/{symbol}` | GET | Get detailed data for specific symbol |
| `/api/market/history/{symbol}` | GET | Get historical price data |
| `/api/market/scanner` | GET | Real-time market scanner |

### Backtesting Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/backtest/run` | POST | Run backtest with strategy parameters |
| `/api/backtest/history` | GET | Get backtest history |
| `/api/backtest/results/{id}` | GET | Get detailed backtest results |
| `/api/backtest/optimize` | POST | Run parameter optimization |

### AI Trading Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/trading/signals` | GET | Get AI trading signals |
| `/api/ai/trading/analyze` | POST | Analyze trading strategy |
| `/api/ai/trading/optimize` | POST | Optimize trading parameters |

### System Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/system/status` | GET | System health check |
| `/api/system/metrics` | GET | Performance metrics |
| `/api/auth/login` | POST | User authentication |

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI library with hooks
- **TypeScript** - Type safety and better developer experience
- **Ant Design** - Enterprise UI components
- **Recharts** & **Lightweight Charts** - Data visualization
- **Redux Toolkit** - State management
- **React Router** - Navigation and routing
- **Axios** - HTTP client with interceptors

### Backend
- **Flask** - Lightweight web framework
- **Flask-CORS** - Cross-origin resource sharing
- **Requests** - HTTP library for API calls
- **Pandas & NumPy** - Data manipulation and analysis
- **yfinance** - Yahoo Finance integration
- **Concurrent.Futures** - Parallel processing
- **Pytz** - Timezone handling

### Data Sources
- **Finnhub API** - Real-time and historical market data
- **Alpaca API** - Trading and market data (paper/live)
- **Twelve Data API** - Alternative market data
- **Yahoo Finance** - Fallback data source

### Development Tools
- **ESLint** - Code quality
- **Prettier** - Code formatting
- **Git** - Version control
- **Postman/Insomnia** - API testing

## 🔍 Key Features in Detail

### Intelligent Caching System
```python
# Backend caching implementation
_profile_cache = {}
_PROFILE_CACHE_TTL = 24 * 60 * 60  # 24 hours

def get_cached_profile(symbol):
    """Get profile data with cache validation"""
    if symbol in _profile_cache:
        cache_entry = _profile_cache[symbol]
        if time.time() - cache_entry['timestamp'] < _PROFILE_CACHE_TTL:
            return cache_entry['data']
    return None
```

### Batch Request Optimization
```python
# Reduce API calls from 20 to 11 for Dashboard
def get_finnhub_stock_data_batch(symbols):
    """Batch request optimization for Finnhub API"""
    batch_size = 10  # Finnhub batch limit
    results = {}
    for i in range(0, len(symbols), batch_size):
        batch = symbols[i:i+batch_size]
        batch_symbols = ','.join(batch)
        response = requests.get(f"{FINNHUB_BASE_URL}/quote?symbol={batch_symbols}")
        # Process batch response
    return results
```

### Concurrent Data Fetching
```python
# Thread pool for parallel profile fetching
def get_finnhub_profiles_concurrent(symbols):
    """Fetch stock profiles concurrently"""
    with ThreadPoolExecutor(max_workers=5) as executor:
        future_to_symbol = {
            executor.submit(get_finnhub_profile, symbol): symbol 
            for symbol in symbols
        }
        results = {}
        for future in as_completed(future_to_symbol):
            symbol = future_to_symbol[future]
            try:
                results[symbol] = future.result()
            except Exception as e:
                results[symbol] = {'error': str(e)}
    return results
```

## 📈 Performance Metrics

The platform calculates 15+ financial metrics for backtest evaluation:

1. **Total Return** - Overall return percentage
2. **Annualized Return** - Compounded annual growth rate
3. **Sharpe Ratio** - Risk-adjusted return (excess return per unit of risk)
4. **Sortino Ratio** - Downside risk-adjusted return
5. **Max Drawdown** - Maximum peak-to-trough decline
6. **Calmar Ratio** - Return to max drawdown ratio
7. **Win Rate** - Percentage of winning trades
8. **Profit Factor** - Gross profit / gross loss ratio
9. **Expectancy** - Expected value per trade
10. **Volatility** - Annualized standard deviation of returns
11. **Alpha** - Risk-adjusted excess return vs benchmark
12. **Beta** - Sensitivity to market movements
13. **R-Squared** - Percentage of variance explained by benchmark
14. **Treynor Ratio** - Risk-adjusted return (beta-adjusted)
15. **Information Ratio** - Active return per unit of active risk

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Commit Message Convention
We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Example: `feat: add AI trading signals module`

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Finnhub](https://finnhub.io/) for market data API
- [Alpaca](https://alpaca.markets/) for trading API
- [Ant Design](https://ant.design/) for UI components
- [React](https://reactjs.org/) for frontend framework
- [Flask](https://flask.palletsprojects.com/) for backend framework

## 📞 Support

For support, please:
1. Check the [documentation](docs/)
2. Search existing [issues](https://github.com/yourusername/quant-trading-platform/issues)
3. Create a new issue if needed

---

## 🇨🇳 中文文档 (Chinese Documentation)

### 项目概述
专业量化交易平台，采用前后端分离架构，提供完整的量化交易功能，包括实时市场数据、回测引擎、AI交易信号和投资组合管理。

### 核心功能
- **实时市场数据**：多数据源（Finnhub、Alpaca、Yahoo Finance）
- **交互式图表**：K线图，支持多时间周期（1日、1周、1月、1年）
- **AI交易信号**：基于机器学习的买卖建议
- **参数优化**：遗传算法策略优化
- **回测引擎**：15+金融指标计算
- **投资组合管理**：模拟交易和持仓跟踪

### 快速开始
1. 克隆仓库：`git clone https://github.com/yourusername/quant-trading-platform.git`
2. 安装后端依赖：`cd backend && pip install -r requirements.txt`
3. 启动后端：`python start_quant_backend.py`
4. 安装前端依赖：`cd frontend && npm install`
5. 启动前端：`npm start`

### 数据源配置
在 `.env` 文件中配置API密钥：
- FINNHUB_API_KEY: Finnhub API密钥
- ALPACA_API_KEY: Alpaca交易API密钥
- ALPACA_SECRET_KEY: Alpaca交易API密钥

### 性能优化
- **批量请求**：HTTP请求减少45%
- **智能缓存**：24小时配置文件缓存
- **并发处理**：线程池并行获取数据
- **骨架屏**：数据加载期间立即显示UI

### 许可证
本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

**版本**: 1.0.0  
**最后更新**: 2026-04-12  
**状态**: Active Development