# Professional Quantitative Trading Platform

A modern quantitative trading platform with frontend-backend separation architecture.

## Project Structure

```
professional_quant_platform/
│
├── backend/                    # Python Flask backend (优化版)
│   ├── final_production.py     # 主应用文件 - 包含性能优化
│   ├── config.py              # 配置文件
│   ├── requirements.txt       # Python依赖
│   ├── .env                  # 环境配置
│   └── __pycache__/          # Python缓存
│
├── frontend/                  # React前端应用
│   ├── src/                  # 源代码
│   │   ├── pages/           # 页面组件
│   │   │   ├── Dashboard.tsx    # 仪表板（含骨架屏）
│   │   │   ├── Market.tsx       # 市场数据（优化骨架屏）
│   │   │   ├── SymbolAnalysis.tsx # 股票分析（修复版）
│   │   │   └── ...其他页面
│   │   ├── services/        # 服务层
│   │   │   └── marketDataService.ts # 市场数据服务
│   │   └── components/      # 通用组件
│   ├── public/              # 静态资源
│   └── package.json         # 前端依赖
│
├── docs/                    # 文档
│   ├── DEVELOPMENT_LOG.md   # 开发日志（新增）
│   ├── DEBUG_REPORT.md     # 调试报告
│   ├── FIX_GUIDE.md        # 修复指南
│   ├── PYTHON_SETUP.md     # Python设置
│   └── QUICK_START.md      # 快速开始
│
├── scripts/                # 启动脚本
│   ├── start_backend.bat   # 启动后端
│   ├── start_frontend.bat  # 启动前端
│   └── start_platform.bat  # 启动全平台
│
├── README.md              # 主项目文档
└── .gitignore            # Git忽略规则
```

## 当前项目状态（2026-03-21更新）

### 数据源与API
- **Dashboard/Market数据**：Finnhub API（批量请求 + 缓存优化）
- **历史数据**：Twelve Data API（1周30分钟图表数据已修复）
- **备用数据源**：Yahoo Finance（yfinance库）

### 性能优化完成
1. **批量请求优化**
   - Finnhub批量quote API：减少HTTP请求从20次到11次
   - 首次加载：5-10秒 → 1-2秒（提升80%）

2. **Profile数据缓存**
   - 内存缓存，TTL=24小时
   - 并发获取：ThreadPoolExecutor(max_workers=5)
   - 后续加载：5-10秒 → <0.1秒（提升99%）

3. **前端显示优化**
   - Market页面：骨架屏替换全页面loading
   - 立即显示结构，改善用户体验

### 缓存/并发优化逻辑
```python
# 后端缓存机制
_profile_cache = {}  # 内存缓存
_PROFILE_CACHE_TTL = 24 * 60 * 60  # 24小时

# 批量请求
def get_finnhub_stock_data_batch(symbols):
    # 使用Finnhub批量API: /quote?symbol=AAPL,MSFT,...
    pass

# 并发获取profile
def get_finnhub_profiles_concurrent(symbols):
    # 使用线程池并发获取
    pass
```

### 前端优化
```typescript
// Market.tsx - 骨架屏优化
{loading ? (
  <Card>
    <Skeleton active paragraph={{ rows: 10 }} />
  </Card>
) : (
  // 实际表格数据
)}
```

## Quick Start

### 1. Frontend Setup
```bash
cd frontend
npm install
npm start
```
Frontend will start at http://localhost:3000

### 2. Backend Setup
确保Python 3.8+已安装，然后：
```bash
cd backend
pip install -r requirements.txt
python final_production.py
```
后端将启动在 http://localhost:8890

**注意**：当前主后端文件为`final_production.py`（包含所有性能优化）

Detailed Python installation guide: [PYTHON_SETUP.md](./docs/PYTHON_SETUP.md)

## Features

### Frontend Features
- **Dashboard** - System status and market overview
- **Market Data** - Real-time stock data display
- **Backtest Engine** - Strategy testing with 15+ metrics
- **Strategy Comparison** - Multi-strategy performance comparison
- **Strategy Ranking** - Historical backtest performance ranking
- **Watchlist** - Stock symbol management
- **Trading Charts** - K-line charts with buy/sell signals
- **Backtest History** - Complete backtest result tracking
- **Backtest Detail** - Detailed analysis of individual backtests

### Backend Features
- **RESTful API** - Clean API endpoints
- **Stock Data** - Yahoo Finance integration (yfinance)
- **Backtest Engine** - Moving average strategy implementation
- **Performance Metrics** - 15+ financial metrics calculation
- **Data Caching** - Efficient data retrieval
- **History Storage** - Backtest result persistence

## API Endpoints (当前有效)

### 市场数据 API
- `GET /api/market/stocks` - 获取股票数据（支持批量+缓存）
  - 参数：`?dashboard=true`（Dashboard专用模式）
  - 数据源：Finnhub（批量quote + 并发profile）
  - 性能：首次1-2秒，后续<0.1秒（缓存命中）

- `GET /api/market/history/{symbol}` - 获取历史数据
  - 参数：`?range=1week&interval=30min`
  - 数据源：Twelve Data（修复版，包含:00和:30数据点）
  - 输出：300个30分钟数据点

### 系统 API
- `GET /api/system/status` - 系统健康检查
- `POST /api/auth/login` - 用户认证（待实现）

### 回测引擎 API
- `POST /api/backtest/run` - 运行回测（同步）
- `GET /api/backtest/history` - 获取回测历史
- `GET /api/backtest/results/{backtest_id}` - 获取特定回测结果

### Performance Metrics (15+)
1. **Total Return** - Overall return percentage
2. **Annualized Return** - Compounded annual growth rate
3. **Profit/Loss** - Absolute profit/loss amount
4. **Sharpe Ratio** - Risk-adjusted return
5. **Sortino Ratio** - Downside risk-adjusted return
6. **Max Drawdown** - Maximum peak-to-trough decline
7. **Calmar Ratio** - Return to max drawdown ratio
8. **Win Rate** - Percentage of winning trades
9. **Trades** - Total number of trades
10. **Avg Return per Trade** - Average trade return
11. **Volatility** - Annualized volatility
12. **Profit Factor** - Gross profit / gross loss ratio
13. **Expectancy** - Expected value per trade
14. **Exposure** - Market exposure percentage
15. **Equity Curve** - Daily portfolio value progression

## Pages Overview

### 1. Dashboard (`/`)
System overview with market data and recent backtests.

### 2. Market (`/market`)
Real-time stock market data with popular symbols.

### 3. Backtest (`/backtest`)
Core backtesting interface with strategy configuration and results display.

### 4. Strategy Comparison (`/compare`)
Compare multiple backtest results side-by-side with normalized equity curves.

### 5. Strategy Ranking (`/ranking`)
Rank historical backtests by performance metrics (default: Total Return).

### 6. Watchlist (`/watchlist`)
Manage favorite stock symbols and run quick backtests.

### 7. Backtest Detail (`/backtest/:id`)
Detailed view of individual backtest with full metrics and charts.

### 8. Profile (`/profile`)
User profile page (coming soon).

## Technical Stack

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Ant Design** - UI components（含Skeleton骨架屏）
- **Recharts** - Data visualization（1周图表X轴已修复）
- **React Router** - Navigation
- **Axios** - HTTP client

### Backend
- **Flask** - Web framework（端口8890）
- **Finnhub API** - 实时市场数据（批量+缓存优化）
- **Twelve Data API** - 历史图表数据（1周30分钟数据修复）
- **yfinance** - 备用股票数据源
- **pandas/numpy** - 数据分析
- **concurrent.futures** - 并发请求处理
- **内存缓存** - Profile数据24小时缓存

## Development Guide

### Code Standards
- Frontend: TypeScript with ESLint
- Backend: PEP 8 Python style guide
- API: RESTful design principles

### Testing
```bash
# Frontend testing
cd frontend
npm test

# Backend testing
cd backend
python -m pytest
```

## Environment Configuration

### Backend Environment Variables
Copy `.env.example` to `.env` and configure:
```env
FLASK_APP=start_quant_backend.py
FLASK_ENV=development
JWT_SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///quant.db
```

## Deployment

### Production Deployment
1. Set production environment variables
2. Use Gunicorn for backend
3. Build frontend production version
4. Configure Nginx reverse proxy

### Docker Deployment
```bash
docker-compose up --build
```

## Troubleshooting

Common issues and solutions: [DEBUG_REPORT.md](./docs/DEBUG_REPORT.md)

## Project Status (2026-03-21)

### ✅ 已完成功能
- **回测引擎**：15+金融指标计算
- **市场数据**：实时股票数据（Finnhub + 缓存优化）
- **图表分析**：1周30分钟图表数据（Twelve Data修复版）
- **性能优化**：批量请求 + 缓存 + 并发处理
- **前端显示**：Market页面骨架屏优化

### 🔄 近期优化完成
1. **Dashboard/Market性能优化**（2026-03-21）
   - 批量请求：HTTP请求减少45%
   - 内存缓存：Profile数据24小时缓存
   - 并发处理：线程池并发获取
   - 前端骨架屏：立即显示页面结构

2. **图表数据修复**（2026-03-20）
   - 1周30分钟图表数据完整修复
   - X轴标签显示优化（3标签/交易日）
   - 周末数据正确过滤

### 📋 后续优化方向
1. **前端优化**
   - Dashboard骨架屏完整实现
   - 前端本地缓存（sessionStorage）
   - 请求去重机制

2. **后端优化**
   - Redis分布式缓存（如需多实例部署）
   - WebSocket实时数据更新
   - API响应时间监控

3. **代码质量**
   - TypeScript严格模式启用
   - 统一错误处理模式
   - 自动化测试覆盖

4. **功能扩展**
   - 用户认证系统
   - 更多策略类型
   - 实时数据流
   - 高级风险分析

## License

MIT License

---

## 中文翻译备注

### 项目概述
专业量化交易平台，采用前后端分离架构，提供完整的量化交易功能。

### 核心功能
- **回测引擎**：支持15+金融指标计算
- **策略比较**：多策略并行对比分析
- **性能排名**：历史回测结果排名
- **观察列表**：股票符号管理
- **交易图表**：K线图+买卖信号标记

### 技术特点
- **前端**：React + TypeScript + Ant Design
- **后端**：Flask + yfinance + pandas
- **数据**：Yahoo Finance实时数据
- **架构**：RESTful API设计

### 使用说明
1. 启动后端：`python start_quant_backend.py` (端口8889)
2. 启动前端：`npm start` (端口3000)
3. 访问地址：http://localhost:3000

### 开发状态
✅ 核心功能已完成
🔄 部分功能开发中
📋 计划功能待开发

### 注意事项
- 需要Python 3.8+环境
- 首次运行需安装依赖：`pip install -r requirements.txt`
- 详细问题排查请查看DEBUG_REPORT.md