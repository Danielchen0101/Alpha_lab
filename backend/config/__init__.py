"""
配置管理模块 - 从环境变量加载配置
"""

import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# ========== Polygon.io 配置 ==========
POLYGON_API_KEY = os.getenv('POLYGON_API_KEY')
POLYGON_BASE_URL = os.getenv('POLYGON_BASE_URL', 'https://api.polygon.io')

# Polygon API 端点
POLYGON_ENDPOINTS = {
    # 股票基本信息
    "ticker_details": "/v3/reference/tickers/{ticker}",
    "ticker_news": "/v2/reference/news",
    "tickers": "/v3/reference/tickers",
    
    # 价格数据
    "aggregates": "/v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}",
    "grouped_daily": "/v2/aggs/grouped/locale/us/market/stocks/{date}",
    "daily_open_close": "/v1/open-close/{ticker}/{date}",
    "previous_close": "/v2/aggs/ticker/{ticker}/prev",
    
    # 技术指标
    "sma": "/v1/indicators/sma/{ticker}",
    "ema": "/v1/indicators/ema/{ticker}",
    "macd": "/v1/indicators/macd/{ticker}",
    "rsi": "/v1/indicators/rsi/{ticker}",
}

# ========== Alpaca Markets 配置 ==========
ALPACA_API_KEY = os.getenv('ALPACA_API_KEY')
ALPACA_API_SECRET = os.getenv('ALPACA_API_SECRET')
ALPACA_BASE_URL = os.getenv('ALPACA_BASE_URL', 'https://paper-api.alpaca.markets/v2')

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

# ========== 其他 API 配置 ==========
FINNHUB_API_KEY = os.getenv('FINNHUB_API_KEY')

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
    "finnhub": "Finnhub",
}

# 请求超时设置
REQUEST_TIMEOUT = 10  # 秒

# 缓存配置
CACHE_TTL = int(os.getenv('CACHE_TTL', 300))  # 5分钟
MAX_CACHE_SIZE = int(os.getenv('MAX_CACHE_SIZE', 1000))

# 验证配置
def validate_config():
    """验证必要的配置是否存在"""
    errors = []
    
    if not POLYGON_API_KEY:
        errors.append("POLYGON_API_KEY 未配置")
    
    if not ALPACA_API_KEY:
        errors.append("ALPACA_API_KEY 未配置")
    
    if not ALPACA_API_SECRET:
        errors.append("ALPACA_API_SECRET 未配置")
    
    return errors

# 检查配置
config_errors = validate_config()
if config_errors:
    print("配置错误:")
    for error in config_errors:
        print(f"  - {error}")
    print("请检查 .env 文件配置")