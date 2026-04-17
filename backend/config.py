"""
API 配置 - 市场数据与交易执行分离架构
"""

# ========== Finnhub API 配置 (市场数据) ==========
FINNHUB_API_KEY = "d7apg21r01qtpbh9ck9gd7apg21r01qtpbh9cka0"
FINNHUB_BASE_URL = "https://finnhub.io/api/v1"

# ========== Twelve Data API 配置 (历史数据) - 已弃用 ==========
# TWELVEDATA_API_KEY = "8b847a1ef2aa47a68d3f992bd0275f0c"  # 有效API密钥 - 已弃用
# TWELVEDATA_BASE_URL = "https://api.twelvedata.com"  # 已弃用

# ========== Alpaca API 配置 (交易执行) ==========
ALPACA_API_KEY = "AKOQQPZNXXOAYAZKDWF7LV4E3D"
ALPACA_API_SECRET = "93oAgKVTjHjkyzA1fZpHeW4wUkwaYZvzEohcMe5dgXMP"
ALPACA_BASE_URL = "https://api.alpaca.markets"  # 真实交易API endpoint

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
    # 市场数据
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
    "market_data": "Finnhub",
    "trading": "Alpaca Markets",
}

# 请求超时设置
REQUEST_TIMEOUT = 10  # 秒

# ==================== API速率限制配置 ====================
# Alpaca免费层限制
ALPACA_RATE_LIMIT = {
    'historical_bars_per_minute': 200,  # 历史数据每分钟200次调用
    'snapshots_per_minute': 200,        # 快照每分钟200次调用
    'websocket_symbols': 30,            # WebSocket最多30个符号
    'requests_per_second': 10           # 每秒最多10次请求
}

# Finnhub免费层限制
FINNHUB_RATE_LIMIT = {
    'calls_per_minute': 60,             # 每分钟60次调用
    'calls_per_second': 30,             # 每秒最多30次调用（突发限制）
    'news_calls_per_minute': 30         # 新闻API每分钟30次调用
}

# AI分析配置
AI_ANALYSIS_CONFIG = {
    'timeout_seconds': 60,              # AI分析超时时间（秒）
    'max_concurrent_calls': 5,          # 最大并发AI调用数
    'retry_attempts': 2                 # 失败重试次数
}
