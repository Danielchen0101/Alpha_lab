"""
配置管理模块 - 从环境变量加载配置
"""

import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# ========== Finnhub 配置 ==========
FINNHUB_API_KEY = os.getenv('FINNHUB_API_KEY', 'd7apg21r01qtpbh9ck9gd7apg21r01qtpbh9cka0')
FINNHUB_BASE_URL = os.getenv('FINNHUB_BASE_URL', 'https://finnhub.io/api/v1')

# ========== Twelve Data 配置 ==========
TWELVEDATA_API_KEY = os.getenv('TWELVEDATA_API_KEY', '8b847a1ef2aa47a68d3f992bd0275f0c')
TWELVEDATA_BASE_URL = os.getenv('TWELVEDATA_BASE_URL', 'https://api.twelvedata.com')

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
    
    # 市场数据
    "bars": "/bars",
    "latest_bars": "/bars/latest",
    "trades": "/trades",
    "quotes": "/quotes",
    "snapshot": "/snapshots",
}

# ========== 通用配置 ==========
# 默认股票列表 - 混合行业候选池
DEFAULT_SYMBOLS = [
    # Technology (必须包含的)
    "AAPL",  # Apple Inc. - Technology
    "NVDA",  # NVIDIA Corporation - Technology/Semiconductors
    
    # Automotive
    "TSLA",  # Tesla Inc. - Automotive
    
    # 其他行业 - 确保多样性
    "JPM",   # JPMorgan Chase & Co. - Financial Services
    "JNJ",   # Johnson & Johnson - Healthcare
    "XOM",   # Exxon Mobil Corporation - Energy
    "WMT",   # Walmart Inc. - Consumer Defensive
    "UNH",   # UnitedHealth Group Incorporated - Healthcare
    "V",     # Visa Inc. - Financial Services
    "PG",    # Procter & Gamble Company - Consumer Defensive
    "HD"     # Home Depot Inc. - Consumer Cyclical
]

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

# 缓存配置
CACHE_TTL = int(os.getenv('CACHE_TTL', 300))  # 5分钟
MAX_CACHE_SIZE = int(os.getenv('MAX_CACHE_SIZE', 1000))

# 验证配置
def validate_config():
    """验证必要的配置是否存在"""
    errors = []
    
    if not FINNHUB_API_KEY:
        errors.append("FINNHUB_API_KEY 未配置")
    
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