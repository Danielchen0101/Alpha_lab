"""
API 配置 - 市场数据与交易执行分离架构
"""

# ========== Polygon API 配置 (市场数据) ==========
POLYGON_API_KEY = "Pb17vE12y3eH4ixU_P3or5W89TfFbN7E"
POLYGON_BASE_URL = "https://api.polygon.io"

# Polygon API 端点
POLYGON_ENDPOINTS = {
    # 实时报价
    "ticker_details": "/v3/reference/tickers/{ticker}",
    "ticker_news": "/v2/reference/news",
    "aggregates": "/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}",
    "grouped_daily": "/v2/aggs/grouped/locale/us/market/stocks/{date}",
    "daily_open_close": "/v1/open-close/{ticker}/{date}",
    "previous_close": "/v2/aggs/ticker/{ticker}/prev",
    "tickers": "/v3/reference/tickers",
    # 技术指标
    "sma": "/v1/indicators/sma/{ticker}",
    "ema": "/v1/indicators/ema/{ticker}",
    "macd": "/v1/indicators/macd/{ticker}",
    "rsi": "/v1/indicators/rsi/{ticker}",
}

# ========== Alpaca API 配置 (交易执行) ==========
ALPACA_API_KEY = "PK47HFNRVYZ7XZLLLYUULBIY4R"
ALPACA_API_SECRET = "6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g"
ALPACA_BASE_URL = "https://paper-api.alpaca.markets/v2"

# Alpaca API 端点
ALPACA_ENDPOINTS = {
    # 账户
    "account": "/account",
    "account_config": "/account/configurations",
    "account_activities": "/account/activities",
    # 资产
    "assets": "/assets",
    "asset": "/assets/{symbol_or_asset_id}",
    # 订单
    "orders": "/orders",
    "order": "/orders/{order_id}",
    "order_by_client": "/orders:by_client_order_id",
    # 持仓
    "positions": "/positions",
    "position": "/positions/{symbol_or_asset_id}",
    # 市场数据 (Alpaca 也有，但我们用 Polygon)
    "bars": "/bars",
    "latest_bars": "/bars/latest",
    "trades": "/trades",
    "quotes": "/quotes",
    "snapshot": "/snapshots",
}

# ========== 通用配置 ==========
# 默认股票列表
DEFAULT_SYMBOLS = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "AMZN", "META", "JPM", "JNJ", "V"]

# 时间框架映射
TIMEFRAME_MAP = {
    "1D": {"multiplier": 1, "timespan": "minute", "limit": 390},  # 6.5小时交易时间
    "1W": {"multiplier": 1, "timespan": "day", "limit": 5},       # 5个交易日
    "1M": {"multiplier": 1, "timespan": "day", "limit": 20},      # 约20个交易日
    "3M": {"multiplier": 1, "timespan": "day", "limit": 60},      # 约60个交易日
    "1Y": {"multiplier": 1, "timespan": "day", "limit": 252},     # 约252个交易日
}

# 数据源标记
DATA_SOURCE = {
    "market_data": "Polygon.io",
    "trading": "Alpaca Markets",
}

# 请求超时设置
REQUEST_TIMEOUT = 10  # 秒