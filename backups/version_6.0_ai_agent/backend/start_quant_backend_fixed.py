# 设置默认值
    FINNHUB_API_KEY = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"
    FINNHUB_BASE_URL = "https://finnhub.io/api/v1"
    # 混合行业候选池 - 确保包含AAPL、TSLA、NVDA，并且有不同行业
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
    TIMEFRAME_MAP = {
        "1D": {"multiplier": 1, "timespan": "minute", "limit": 390},
        "1W": {"multiplier": 1, "timespan": "day", "limit": 5},
        "1M": {"multiplier": 1, "timespan": "day", "limit": 20},
        "3M": {"multiplier": 1, "timespan": "day", "limit": 60},
        "1Y": {"multiplier": 1, "timespan": "day", "limit": 252},
    }
    DATA_SOURCE = {"market_data": "Finnhub", "trading": "Alpaca Markets"}
    REQUEST_TIMEOUT = 10

# ==================== AI 接口 ====================

# AI Provider 配置状态
ai_provider_config_state = {
    'apiKey': '',
    'baseURL': 'https://api.deepseek.com',
    'model': 'deepseek-chat'
}

# Alpaca 配置状态
# 注意：当前使用的是 paper trading key，仅用于模拟交易环境
# 真实交易需要使用 live trading key，endpoint 也不同
alpaca_config_state = {
    'paper_api_key': 'PKFQZZXERLVJLJHODHPPEB52RD',  # Paper trading key - 仅用于模拟交易
    'paper_api_secret': '5odo2jBF7YFLa7DAvss3hV7WVXE789ktTor7zMyPewxa',  # Paper trading secret
    'live_api_key': '',  # Live trading key - 预留，用于真实交易
    'live_api_secret': '',  # Live trading secret
    'environment': 'paper'  # 'paper' 或 'live' - 当前为 paper 环境
}

# ==================== 缓存配置 ====================
CACHE_TTL = 60  # 缓存时间（秒）

# ==================== Backtest History 配置 ====================
# 全局的backtest历史存储
backtest_history = []
backtest_history_lock = threading.Lock()
MAX_HISTORY_SIZE = 100  # 最多保存100个backtest记录

print(f"[Backtest History] 初始化: backtest_history = {backtest_history}, id = {id(backtest_history)}")

class SimpleCache:
    """简单内存缓存"""
    def __init__(self):
        self.cache = {}
        self.timestamps = {}

    def get(self, key):
        if key in self.cache:
            timestamp = self.timestamps.get(key, 0)
            if time.time() - timestamp < CACHE_TTL:
                return self.cache[key]
            else:
                # 缓存过期，删除
                del self.cache[key]
                del self.timestamps[key]
        return None

    def set(self, key, value):
        self.cache[key] = value
        self.timestamps[key] = time.time()

    def clear(self):
        self.cache.clear()
        self.timestamps.clear()

# 全局缓存实例
stock_cache = SimpleCache()

def get_cache_key(symbol, data_type):
    """生成缓存键"""
    return f"{symbol}_{data_type}"

# ==================== Alpaca Market Data 函数 ====================
def fetch_alpaca_stock_data(symbol):
    """获取Alpaca股票数据（最新报价和基本信息）"""
    cache_key = get_cache_key(symbol, 'alpaca_quote')
    
    # 暂时禁用缓存，避免数据结构问题
    # cached = stock_cache.get(cache_key)
    # if cached:
    #     print(f'[Alpaca数据] 使用缓存数据: {symbol}')
    #     return cached, None
    
    print(f'[Alpaca数据] 开始获取 {symbol} 数据')