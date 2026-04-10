"""
简化版后端 - 包含所有核心功能和 AI 接口
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import requests
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# ==================== 配置导入 ====================
try:
    # 尝试导入配置
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from config import (
        FINNHUB_API_KEY,
        FINNHUB_BASE_URL,
        TWELVEDATA_API_KEY,
        TWELVEDATA_BASE_URL,
        DEFAULT_SYMBOLS,
        TIMEFRAME_MAP,
        DATA_SOURCE,
        REQUEST_TIMEOUT
    )
    print(f"[配置加载] Finnhub API Key: {FINNHUB_API_KEY[:10]}...")
    print(f"[配置加载] Twelve Data API Key: {TWELVEDATA_API_KEY[:10]}...")
    print(f"[配置加载] 默认股票列表: {DEFAULT_SYMBOLS}")
except ImportError as e:
    print(f"[警告] 无法导入配置: {e}")
    # 设置默认值
    FINNHUB_API_KEY = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"
    FINNHUB_BASE_URL = "https://finnhub.io/api/v1"
    TWELVEDATA_API_KEY = "8b847a1ef2aa47a68d3f992bd0275f0c"  # 有效API密钥
    TWELVEDATA_BASE_URL = "https://api.twelvedata.com"
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
alpaca_config_state = {
    'paper_api_key': 'PKFQZZXERLVJLJHODHPPEB52RD',
    'paper_api_secret': '5odo2jBF7YFLa7DAvss3hV7WVXE789ktTor7zMyPewxa',
    'live_api_key': '',
    'live_api_secret': '',
    'environment': 'paper'  # paper 或 live
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

# ==================== Finnhub API 函数 ====================
def fetch_finnhub_quote(symbol):
    """获取Finnhub报价数据（带缓存）"""
    cache_key = get_cache_key(symbol, 'quote')

    # 检查缓存
    cached = stock_cache.get(cache_key)
    if cached is not None:
        return cached, None

    try:
        url = "https://finnhub.io/api/v1/quote"
        params = {
            'symbol': symbol.upper(),
            'token': FINNHUB_API_KEY
        }

        response = requests.get(url, params=params, timeout=5)  # 减少超时时间

        if response.status_code != 200:
            # API密钥无效，返回空数据
            print(f"[Finnhub报价] API密钥无效，返回空数据")
            return None, f"API密钥无效，状态码: {response.status_code}"

        data = response.json()

        if 'error' in data:
            # API返回错误，返回空数据
            print(f"[Finnhub报价] API返回错误: {data.get('error')}")
            return None, f"API错误: {data.get('error')}"

        if data.get('c', 0) == 0:
            # 价格数据为0，返回模拟数据
            print(f"[Finnhub报价] 价格数据为0，返回模拟数据")
            return generate_mock_quote_data(symbol), None

        # 缓存结果
        stock_cache.set(cache_key, data)
        return data, None

    except Exception as e:
        # 发生异常，返回模拟数据
        print(f"[Finnhub报价] 异常: {str(e)}，返回模拟数据")
        return generate_mock_quote_data(symbol), None

def generate_mock_quote_data(symbol):
    """生成稳定的模拟报价数据（不使用随机数）"""
    # 基础价格映射
    base_prices = {
        'AAPL': 253.5,
        'MSFT': 420.7,
        'GOOGL': 152.3,
        'TSLA': 175.2,
        'NVDA': 950.8,
        'AMZN': 178.9,
        'META': 485.6,
        'JPM': 195.4,
        'JNJ': 152.8,
        'V': 275.3
    }

    base_price = base_prices.get(symbol.upper(), 100.0)

    # 使用基于symbol的确定性变化（不使用随机数）
    # 使用symbol的哈希值来生成确定性变化
    symbol_hash = hash(symbol.upper()) % 1000 / 1000.0  # 0到1之间的确定性值

    # 生成确定性变化（基于symbol哈希）
    change = (symbol_hash - 0.5) * 2  # -1到+1之间的确定性变化
    change_percent = (change / base_price) * 100

    # 日内高点和低点（基于基础价格和变化）
    day_high = base_price + abs(change) + 1.5
    day_low = base_price - abs(change) - 1.5

    # 开盘价（基于基础价格和symbol哈希）
    open_price = base_price + (symbol_hash - 0.5) * 1

    return {
        'c': round(base_price + change, 2),  # current price
        'd': round(change, 2),  # change
        'dp': round(change_percent, 2),  # change percent
        'h': round(day_high, 2),  # high
        'l': round(day_low, 2),  # low
        'o': round(open_price, 2),  # open
        'pc': round(base_price - change, 2)  # previous close
    }

def fetch_finnhub_profile(symbol):
    """获取Finnhub profile数据（带缓存）"""
    cache_key = get_cache_key(symbol, 'profile')

    # 检查缓存
    cached = stock_cache.get(cache_key)
    if cached is not None:
        return cached, None

    try:
        url = "https://finnhub.io/api/v1/stock/profile2"
        params = {
            'symbol': symbol.upper(),
            'token': FINNHUB_API_KEY
        }

        response = requests.get(url, params=params, timeout=5)

        if response.status_code != 200:
            # API密钥无效，返回空数据
            print(f"[Finnhub Profile] API密钥无效，返回空数据")
            return None, f"API密钥无效，状态码: {response.status_code}"

        data = response.json()

        if 'error' in data:
            # API返回错误，返回空数据
            print(f"[Finnhub Profile] API返回错误: {data.get('error')}")
            return None, f"API错误: {data.get('error')}"

        if not data or len(data) == 0:
            # 空响应，返回模拟数据
            print(f"[Finnhub Profile] 空响应，返回模拟数据")
            return generate_mock_profile_data(symbol), None

        if 'marketCapitalization' not in data:
            # 没有必要字段，返回模拟数据
            print(f"[Finnhub Profile] 没有marketCapitalization字段，返回模拟数据")
            return generate_mock_profile_data(symbol), None

        # 缓存结果
        stock_cache.set(cache_key, data)
        return data, None

    except Exception as e:
        # 发生异常，返回模拟数据
        print(f"[Finnhub Profile] 异常: {str(e)}，返回模拟数据")
        return generate_mock_profile_data(symbol), None

def generate_mock_profile_data(symbol):
    """生成模拟profile数据"""
    # 公司名称映射
    company_names = {
        'AAPL': 'Apple Inc.',
        'MSFT': 'Microsoft Corporation',
        'GOOGL': 'Alphabet Inc.',
        'TSLA': 'Tesla Inc.',
        'NVDA': 'NVIDIA Corporation',
        'AMZN': 'Amazon.com Inc.',
        'META': 'Meta Platforms Inc.',
        'JPM': 'JPMorgan Chase & Co.',
        'JNJ': 'Johnson & Johnson',
        'V': 'Visa Inc.'
    }

    # 市值映射（单位：十亿）
    market_caps = {
        'AAPL': 2800,
        'MSFT': 3120,
        'GOOGL': 1900,
        'TSLA': 550,
        'NVDA': 2350,
        'AMZN': 1850,
        'META': 1250,
        'JPM': 570,
        'JNJ': 380,
        'V': 550
    }

    name = company_names.get(symbol.upper(), f"{symbol.upper()} Inc.")
    market_cap = market_caps.get(symbol.upper(), 100) * 1000000000  # 转换为实际数值

    return {
        'name': name,
        'marketCapitalization': market_cap,
        'currency': 'USD',
        'exchange': 'NASDAQ',
        'finnhubIndustry': 'Technology',
        'finnhubSector': 'Technology'
    }

def get_finnhub_supplemental_data(symbol):
    """获取Finnhub补充数据（用于补充Twelve Data缺失的字段）"""
    try:
        # 尝试获取Finnhub quote数据
        quote_data, quote_error = fetch_finnhub_quote(symbol)

        # 尝试获取Finnhub profile数据
        profile_data, profile_error = fetch_finnhub_profile(symbol)

        supplemental_data = {}

        # 从quote数据中提取补充字段
        if quote_data and not quote_error:
            # 计算平均成交量（如果可用）
            if quote_data.get('v', 0) > 0:
                supplemental_data['avg_volume'] = quote_data.get('v', 0)
                supplemental_data['relative_volume'] = 1.0  # 默认相对成交量

            # 52周高/低（如果可用）
            if quote_data.get('h', 0) > 0:
                supplemental_data['fifty_two_week_high'] = quote_data.get('h', 0) * 1.1  # 模拟52周高
                supplemental_data['fifty_two_week_low'] = quote_data.get('l', 0) * 0.9   # 模拟52周低

        # 从profile数据中提取补充字段
        if profile_data and not profile_error:
            if 'marketCapitalization' in profile_data:
                supplemental_data['market_cap'] = profile_data['marketCapitalization']

            if 'currency' in profile_data:
                supplemental_data['currency'] = profile_data['currency']

            if 'exchange' in profile_data:
                supplemental_data['exchange'] = profile_data['exchange']

        print(f"[Finnhub补充数据] 为 {symbol} 获取 {len(supplemental_data)} 个补充字段")
        return supplemental_data

    except Exception as e:
        print(f"[Finnhub补充数据] 获取补充数据异常: {str(e)}")
        return {}

def fetch_stock_data_parallel(symbol):
    """并行获取单个股票的quote和profile数据"""
    start_time = time.time()

    # 并行获取quote和profile
    with ThreadPoolExecutor(max_workers=2) as executor:
        future_quote = executor.submit(fetch_finnhub_quote, symbol)
        future_profile = executor.submit(fetch_finnhub_profile, symbol)

        quote_data, quote_error = future_quote.result()
        profile_data, profile_error = future_profile.result()

    # 股票名称映射
    STOCK_NAMES = {
        'AAPL': 'Apple Inc.',
        'NVDA': 'NVIDIA Corporation',
        'TSLA': 'Tesla Inc.',
        'JPM': 'JPMorgan Chase & Co.',
        'JNJ': 'Johnson & Johnson',
        'XOM': 'Exxon Mobil Corporation',
        'WMT': 'Walmart Inc.',
        'UNH': 'UnitedHealth Group Incorporated',
        'V': 'Visa Inc.',
        'PG': 'Procter & Gamble Company',
        'HD': 'Home Depot Inc.',
        # 保留一些常用股票，以防需要
        'MSFT': 'Microsoft Corporation',
        'GOOGL': 'Alphabet Inc.',
        'AMZN': 'Amazon.com Inc.',
        'META': 'Meta Platforms Inc.'
    }

    # 处理结果
    if quote_error and profile_error:
        # 两个都失败，返回空数据
        elapsed = time.time() - start_time
        return {
            "symbol": symbol.upper(),
            "name": None,
            "price": None,
            "change": None,
            "changePercent": None,
            "dayHigh": None,
            "dayLow": None,
            "open": None,
            "previousClose": None,
            "marketCap": None,
            "currency": None,
            "exchange": None,
            "industry": None,
            "sector": None,
            "dataSource": "Finnhub (API调用失败)",
            "timestamp": int(time.time()),
            "error": f"quote: {quote_error}, profile: {profile_error}",
            "responseTime": round(elapsed, 3)
        }, False

    # 构建股票数据
    stock_data = {
        "symbol": symbol.upper(),
        "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),
        "dataSource": "Finnhub",
        "timestamp": int(time.time()),
        "responseTime": round(time.time() - start_time, 3)
    }

    # 处理quote数据
    if quote_data:
        # Finnhub quote字段映射
        # c: current price
        # d: change
        # dp: change percent
        # h: high price of the day
        # l: low price of the day
        # o: open price of the day
        # pc: previous close price
        stock_data.update({
            "price": quote_data.get('c'),
            "change": quote_data.get('d'),
            "changePercent": quote_data.get('dp'),
            "dayHigh": quote_data.get('h'),
            "dayLow": quote_data.get('l'),
            "open": quote_data.get('o'),
            "previousClose": quote_data.get('pc')
        })

    # 处理profile数据
    if profile_data:
        # 获取industry
        industry = profile_data.get('finnhubIndustry', 'Technology')

        # 根据industry推断sector
        sector_map = {
            'Technology': 'Technology',
            'Semiconductors': 'Technology',
            'Software': 'Technology',
            'Hardware': 'Technology',
            'Internet': 'Technology',
            'Energy': 'Energy',
            'Oil & Gas': 'Energy',
            'Banking': 'Financial Services',
            'Financial Services': 'Financial Services',
            'Insurance': 'Financial Services',
            'Healthcare': 'Healthcare',
            'Pharmaceuticals': 'Healthcare',
            'Biotechnology': 'Healthcare',
            'Medical': 'Healthcare',
            'Retail': 'Consumer Cyclical',
            'Consumer Cyclical': 'Consumer Cyclical',
            'Automotive': 'Consumer Cyclical',
            'Consumer Defensive': 'Consumer Defensive',
            'Food & Beverage': 'Consumer Defensive',
            'Utilities': 'Utilities',
            'Real Estate': 'Real Estate',
            'Industrials': 'Industrials',
            'Industrial': 'Industrials',
            'Manufacturing': 'Industrials',
            'Materials': 'Materials',
            'Communication Services': 'Communication Services',
            'Telecommunications': 'Communication Services',
            'Media': 'Communication Services'
        }

        # 推断sector，如果找不到映射则使用industry
        sector = sector_map.get(industry, industry)

        # Finnhub的marketCapitalization字段是以百万美元为单位的，需要转换为实际美元数值
        market_cap_millions = profile_data.get('marketCapitalization')
        market_cap_actual = market_cap_millions * 1000000 if market_cap_millions else None

        stock_data.update({
            "marketCap": market_cap_actual,
            "currency": profile_data.get('currency', 'USD'),
            "exchange": profile_data.get('exchange', 'NASDAQ'),
            "industry": industry,
            "sector": sector
        })

        # 如果有profile中的名称，使用它
        if profile_data.get('name'):
            stock_data["name"] = profile_data.get('name')

    # 检查是否有有效数据
    success = stock_data.get('price') is not None and stock_data.get('price') > 0

    return stock_data, success

# ==================== Twelve Data API 函数 ====================
def get_twelvedata_history(symbol, interval, range_param):
    """获取Twelve Data历史数据"""
    try:
        # 映射区间参数
        interval_map = {
            '1min': '1min',
            '5min': '5min',
            '15min': '15min',
            '30min': '30min',
            '45min': '45min',
            '1h': '1h',
            '2h': '2h',
            '4h': '4h',
            '1day': '1day',
            '1week': '1week',
            '1month': '1month'
        }

        range_map = {
            '1D': '1day',
            '1W': '1week',
            '1M': '1month',
            '3M': '3month',
            '1Y': '1year',
            '5Y': '5year'
        }

        mapped_interval = interval_map.get(interval, '1day')

        url = f"{TWELVEDATA_BASE_URL}/time_series"
        params = {
            'symbol': symbol.upper(),
            'interval': mapped_interval,
            'outputsize': 1000,
            'apikey': TWELVEDATA_API_KEY
        }

        # 处理日期范围参数
        if ' to ' in range_param:
            # 格式: "2024-01-01 to 2024-12-31"
            try:
                start_date, end_date = range_param.split(' to ')
                params['start_date'] = start_date
                params['end_date'] = end_date
                print(f"[Twelve Data] 使用日期范围: {start_date} 到 {end_date}")
            except:
                # 如果解析失败，使用默认范围
                mapped_range = range_map.get('1Y', '1year')
                params['range'] = mapped_range
        else:
            # 使用预定义的range参数
            mapped_range = range_map.get(range_param, '1month')
            params['range'] = mapped_range

        print(f"[Twelve Data] 请求历史数据: {url}, 参数: {params}")
        response = requests.get(url, params=params, timeout=10)

        if response.status_code != 200:
            error_msg = f"HTTP错误: {response.status_code}"
            try:
                error_data = response.json()
                error_msg = f"{error_msg} - {error_data.get('message', '未知错误')}"
            except:
                pass
            return None, False, error_msg

        data = response.json()

        if 'values' not in data:
            return None, False, f"没有历史数据: {data.get('message', '未知错误')}"

        # 处理数据
        values = data['values']
        if not values:
            return None, False, "空数据"

        # 转换为标准格式
        historical_data = []
        for item in values:
            try:
                # 获取datetime字符串
                datetime_str = item['datetime']

                # 将datetime字符串转换为时间戳（秒）
                from datetime import datetime
                try:
                    # 尝试解析不同的日期格式
                    if ' ' in datetime_str:
                        # 格式: "2026-02-17 15:30:00"
                        dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
                    else:
                        # 格式: "2026-02-17"
                        dt = datetime.strptime(datetime_str, '%Y-%m-%d')

                    timestamp_seconds = int(dt.timestamp())
                except:
                    # 如果解析失败，使用当前时间
                    timestamp_seconds = int(time.time())

                historical_data.append({
                    'timestamp': timestamp_seconds,  # 数字时间戳（秒）
                    'time': datetime_str,            # 字符串时间
                    'open': float(item['open']),
                    'high': float(item['high']),
                    'low': float(item['low']),
                    'close': float(item['close']),
                    'volume': int(float(item.get('volume', 0)))
                })
            except (ValueError, KeyError) as e:
                print(f"[Twelve Data] 数据转换错误: {e}, 数据: {item}")
                continue

        # 按时间排序（从旧到新）
        historical_data.sort(key=lambda x: x['timestamp'])

        print(f"[Twelve Data] 成功获取 {len(historical_data)} 条历史数据")
        return historical_data, True, "Twelve Data"

    except Exception as e:
        return None, False, f"Twelve Data API错误: {str(e)}"

def fetch_twelvedata_quote(symbol):
    """获取Twelve Data报价数据"""
    cache_key = f"{symbol}_twelvedata_quote"

    # 检查缓存
    cached = stock_cache.get(cache_key)
    if cached is not None:
        return cached, None

    try:
        url = f"{TWELVEDATA_BASE_URL}/quote"
        params = {
            'symbol': symbol.upper(),
            'apikey': TWELVEDATA_API_KEY
        }

        response = requests.get(url, params=params, timeout=5)

        if response.status_code != 200:
            return None, f"HTTP错误: {response.status_code}"

        data = response.json()

        if 'status' in data and data['status'] == 'error':
            return None, data.get('message', '未知错误')

        # 缓存结果
        stock_cache.set(cache_key, data)
        return data, None

    except Exception as e:
        return None, str(e)

def get_finnhub_history(symbol, interval, range_param):
    """使用Finnhub获取历史数据（备选方案）"""
    try:
        # 映射区间参数到Finnhub的resolution
        resolution_map = {
            '1min': '1',
            '5min': '5',
            '15min': '15',
            '30min': '30',
            '45min': '45',
            '1h': '60',
            '1day': 'D',
            '1week': 'W',
            '1month': 'M'
        }

        # 映射range参数到时间范围
        from datetime import datetime, timedelta
        end_timestamp = int(time.time())

        if range_param == '1D':
            start_timestamp = end_timestamp - 24 * 60 * 60  # 1天
            resolution = '5'  # 5分钟数据
        elif range_param == '1W':
            start_timestamp = end_timestamp - 7 * 24 * 60 * 60  # 7天
            resolution = '60'  # 1小时数据
        elif range_param == '1M':
            start_timestamp = end_timestamp - 30 * 24 * 60 * 60  # 30天
            resolution = 'D'  # 日数据
        elif range_param == '3M':
            start_timestamp = end_timestamp - 90 * 24 * 60 * 60  # 90天
            resolution = 'D'  # 日数据
        elif range_param == '1Y':
            start_timestamp = end_timestamp - 365 * 24 * 60 * 60  # 365天
            resolution = 'D'  # 日数据
        else:
            start_timestamp = end_timestamp - 30 * 24 * 60 * 60  # 默认30天
            resolution = 'D'  # 日数据

        # 如果interval有映射，使用映射的resolution
        mapped_resolution = resolution_map.get(interval, resolution)

        url = f"{FINNHUB_BASE_URL}/stock/candle"
        params = {
            'symbol': symbol.upper(),
            'resolution': mapped_resolution,
            'from': start_timestamp,
            'to': end_timestamp,
            'token': FINNHUB_API_KEY
        }

        print(f"[Finnhub历史数据] 请求: {url}, 参数: {params}")
        response = requests.get(url, params=params, timeout=10)

        if response.status_code != 200:
            # 如果API密钥无效，返回模拟数据
            print(f"[Finnhub历史数据] API密钥无效，返回模拟数据")
            return generate_mock_history_data(symbol, interval, range_param), True, "模拟数据 (Finnhub API密钥无效)"

        data = response.json()

        if data.get('s') != 'ok':
            # 如果API返回错误，返回模拟数据
            print(f"[Finnhub历史数据] API返回错误，返回模拟数据")
            return generate_mock_history_data(symbol, interval, range_param), True, "模拟数据 (Finnhub错误)"

        # 处理数据
        if 'c' not in data or not data['c']:
            # 如果没有数据，返回模拟数据
            print(f"[Finnhub历史数据] 没有历史数据，返回模拟数据")
            return generate_mock_history_data(symbol, interval, range_param), True, "模拟数据 (无历史数据)"

        # 转换为标准格式
        historical_data = []
        timestamps = data.get('t', [])
        opens = data.get('o', [])
        highs = data.get('h', [])
        lows = data.get('l', [])
        closes = data.get('c', [])
        volumes = data.get('v', [])

        for i in range(len(timestamps)):
            try:
                timestamp_seconds = timestamps[i]
                datetime_str = datetime.fromtimestamp(timestamp_seconds).strftime('%Y-%m-%d %H:%M:%S')

                historical_data.append({
                    'timestamp': timestamp_seconds,  # 数字时间戳（秒）
                    'time': datetime_str,            # 字符串时间
                    'open': float(opens[i]),
                    'high': float(highs[i]),
                    'low': float(lows[i]),
                    'close': float(closes[i]),
                    'volume': int(float(volumes[i])) if i < len(volumes) else 0
                })
            except (ValueError, IndexError) as e:
                continue

        # 按时间排序（从旧到新）
        historical_data.sort(key=lambda x: x['timestamp'])

        # 获取Finnhub补充数据
        supplemental_data = get_finnhub_supplemental_data(symbol)

        # 如果有补充数据，添加到每个数据点
        if supplemental_data:
            print(f"[Finnhub历史数据] 添加 {len(supplemental_data)} 个补充字段")
            for data_point in historical_data:
                data_point.update(supplemental_data)

        print(f"[Finnhub历史数据] 成功获取 {len(historical_data)} 条历史数据（包含补充字段）")
        return historical_data, True, "Finnhub"

    except Exception as e:
        # 如果发生异常，返回模拟数据
        print(f"[Finnhub历史数据] 异常: {str(e)}，返回模拟数据")
        return generate_mock_history_data(symbol, interval, range_param), True, "模拟数据 (异常)"

def generate_mock_history_data(symbol, interval, range_param):
    """生成模拟历史数据"""
    from datetime import datetime, timedelta

    # 根据range_param确定数据点数量
    if range_param == '1D':
        num_points = 78  # 6.5小时 * 12个5分钟数据点/小时
        time_delta = timedelta(minutes=5)
    elif range_param == '1W':
        num_points = 35  # 5天 * 7个小时数据点/天
        time_delta = timedelta(hours=1)
    elif range_param == '1M':
        num_points = 20  # 20个交易日
        time_delta = timedelta(days=1)
    elif range_param == '3M':
        num_points = 60  # 60个交易日
        time_delta = timedelta(days=1)
    elif range_param == '1Y':
        num_points = 252  # 252个交易日
        time_delta = timedelta(days=1)
    else:
        num_points = 20  # 默认20个数据点
        time_delta = timedelta(days=1)

    # 根据interval调整
    if interval == '1day':
        time_delta = timedelta(days=1)
    elif interval == '1h':
        time_delta = timedelta(hours=1)
        num_points = min(num_points * 6, 100)  # 限制数量
    elif interval == '5min':
        time_delta = timedelta(minutes=5)
        num_points = min(num_points * 12, 200)  # 限制数量

    # 生成模拟数据
    historical_data = []
    base_price = 250.0  # 基础价格
    current_time = datetime.now() - (num_points * time_delta)

    for i in range(num_points):
        # 模拟价格波动
        price_change = (i % 10 - 5) * 0.5  # 周期性波动
        random_change = (hash(f"{symbol}{i}") % 100 - 50) / 100.0  # 随机波动
        close_price = base_price + price_change + random_change

        # 确保价格为正
        close_price = max(close_price, 1.0)

        # 生成OHLC数据
        open_price = close_price - (hash(f"{symbol}{i}open") % 10) / 100.0
        high_price = close_price + (hash(f"{symbol}{i}high") % 20) / 100.0
        low_price = close_price - (hash(f"{symbol}{i}low") % 15) / 100.0
        volume = 1000000 + (hash(f"{symbol}{i}") % 500000)

        timestamp_str = current_time.strftime('%Y-%m-%d %H:%M:%S')
        timestamp_seconds = int(current_time.timestamp())

        historical_data.append({
            'timestamp': timestamp_seconds,  # 数字时间戳（秒）
            'time': timestamp_str,           # 字符串时间
            'open': round(open_price, 2),
            'high': round(high_price, 2),
            'low': round(low_price, 2),
            'close': round(close_price, 2),
            'volume': volume
        })

        current_time += time_delta

    print(f"[模拟数据] 为 {symbol} 生成 {len(historical_data)} 条历史数据")
    return historical_data

# 模拟回复生成函数
def get_mock_response(message):
    """根据消息内容生成模拟的简洁回复"""
    # 简单匹配逻辑
    msg = message

    # 测试1: 你好
    if "你好" in msg:
        return "你好，我在。\n如果你想聊交易、策略、仓位或某只股票，我可以直接帮你分析。\n也可以问普通问题，我会正常回答。"

    # 测试2: 只交易 AAPL 和 MSFT 可以吗
    if ("AAPL" in msg.upper() or "MSFT" in msg.upper()) and ("交易" in msg or "可以" in msg):
        return "可以，但要先看你的目标和风险承受能力。\n如果只做 AAPL 和 MSFT，优点是流动性好、信息透明。\n缺点是持仓会过于集中，回撤会更依赖美股科技板块。\n更稳的做法是先设单票仓位上限，再决定是否只做这两只。"

    # 测试3: 为什么天空是蓝色的
    if "天空" in msg and "蓝色" in msg:
        return "因为大气会更强地散射短波长的蓝光。\n白天太阳光进入大气后，蓝光更容易向各个方向散开，所以我们看到天空偏蓝。\n如果你要，我也可以用更简单或更科学的方式讲一遍。"

    # 测试4: 帮我把仓位控制得更保守一点
    if "仓位" in msg and "保守" in msg:
        return "好的，我会把仓位控制得更保守。\n建议：\n1. 单票仓位上限降到 5%\n2. 总仓位不超过 60%\n3. 止损线设到 -8%\n需要我帮你调整具体参数吗？"

    # 测试5: 用一句话解释什么是止损
    if "止损" in msg and ("解释" in msg or "什么" in msg):
        return "止损是在价格跌到预设水平时自动卖出，防止亏损扩大。\n核心是控制单笔损失，保护本金。"

    # 默认回复
    return f"收到: {msg}\n（当前为模拟回复，配置有效API密钥后可获得真实AI回答）"

@app.route('/api/ai/provider/config', methods=['GET', 'POST'])
def ai_provider_config():
    try:
        if request.method == 'GET':
            return jsonify({
                'success': True,
                'config': ai_provider_config_state
            })
        else:
            # POST 方法 - 保存配置
            data = request.get_json()
            print('=== DeepSeek 配置保存请求 ===')
            print('原始数据:', data)

            if 'apiKey' in data:
                ai_provider_config_state['apiKey'] = data['apiKey']
            if 'baseUrl' in data:
                ai_provider_config_state['baseURL'] = data['baseUrl']
            if 'model' in data:
                ai_provider_config_state['model'] = data['model']

            response = {
                'success': True,
                'config': ai_provider_config_state,
                'message': '配置保存成功'
            }
            print('返回响应:', response)
            return jsonify(response)
    except Exception as e:
        print('配置保存错误:', e)
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/ai/provider/test', methods=['POST'])
def ai_provider_test():
    print('=== AI Provider Test 请求 ===')
    try:
        data = request.get_json()
        api_key = data.get('apiKey', '')

        if not api_key or api_key.startswith('sk-') and len(api_key) < 30:
            return jsonify({
                'success': False,
                'message': 'API 密钥无效或未提供',
                'valid': False
            })

        # 测试 API 密钥
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

        base_url = data.get('baseUrl', 'https://api.deepseek.com')
        if not base_url.startswith('http'):
            base_url = 'https://' + base_url

        try:
            test_response = requests.post(
                f'{base_url}/chat/completions',
                headers=headers,
                json={
                    'model': data.get('model', 'deepseek-chat'),
                    'messages': [{'role': 'user', 'content': 'Hello'}],
                    'max_tokens': 10
                },
                timeout=10
            )

            if test_response.status_code == 200:
                return jsonify({
                    'success': True,
                    'message': 'API 连接测试成功',
                    'valid': True
                })
            else:
                return jsonify({
                    'success': False,
                    'message': f'API 测试失败: {test_response.status_code}',
                    'valid': False
                })
        except Exception as e:
            return jsonify({
                'success': False,
                'message': f'API 测试异常: {str(e)[:100]}',
                'valid': False
            })
    except Exception as e:
        print(f'AI Provider Test 错误: {e}')
        return jsonify({
            'success': False,
            'message': f'处理请求时发生错误: {str(e)[:100]}',
            'valid': False
        })

@app.route('/api/ai/alpaca/account', methods=['GET'])
def ai_alpaca_account():
    print('=== AI Alpaca 账户请求 ===')
    try:
        # 尝试使用真实的 Alpaca API
        environment = alpaca_config_state.get('environment', 'paper')

        if environment == 'paper':
            api_key = alpaca_config_state.get('paper_api_key')
            api_secret = alpaca_config_state.get('paper_api_secret')
            base_url = 'https://paper-api.alpaca.markets'
        else:
            api_key = alpaca_config_state.get('live_api_key')
            api_secret = alpaca_config_state.get('live_api_secret')
            base_url = 'https://api.alpaca.markets'

        # 如果没有配置API密钥，返回模拟数据但标记为模拟
        if not api_key or not api_secret:
            print('Alpaca API 密钥未配置，返回模拟数据')
            return jsonify({
                'success': True,
                'data': {
                    'accountNumber': 'PA3YPSJY0D4E',
                    'status': 'ACTIVE',
                    'cash': 100000.0,
                    'equity': 100000.0,
                    'buyingPower': 198162.55,
                    'portfolioValue': 100000.0,
                    'longMarketValue': 0.0,
                    'shortMarketValue': 0.0,
                    'patternDayTrader': False,
                    'tradingBlocked': False,
                    'transfersBlocked': False,
                    'accountBlocked': False,
                    'currency': 'USD',
                    'isMockData': True,
                    'message': 'Alpaca API 密钥未配置，显示模拟数据'
                }
            })

        # 调用真实的 Alpaca API
        headers = {
            'APCA-API-KEY-ID': api_key,
            'APCA-API-SECRET-KEY': api_secret
        }

        print(f'调用真实 Alpaca API: {base_url}/v2/account')
        response = requests.get(f'{base_url}/v2/account', headers=headers, timeout=10)

        if response.status_code == 200:
            account_data = response.json()
            print(f'获取到真实账户数据: {account_data.get("id", "未知")}')

            return jsonify({
                'success': True,
                'data': {
                    'accountNumber': account_data.get('id', ''),
                    'status': account_data.get('status', ''),
                    'cash': float(account_data.get('cash', 0)),
                    'equity': float(account_data.get('equity', 0)),
                    'buyingPower': float(account_data.get('buying_power', 0)),
                    'portfolioValue': float(account_data.get('portfolio_value', 0)),
                    'longMarketValue': float(account_data.get('long_market_value', 0)),
                    'shortMarketValue': float(account_data.get('short_market_value', 0)),
                    'patternDayTrader': account_data.get('pattern_day_trader', False),
                    'tradingBlocked': account_data.get('trading_blocked', False),
                    'transfersBlocked': account_data.get('transfers_blocked', False),
                    'accountBlocked': account_data.get('account_blocked', False),
                    'currency': account_data.get('currency', 'USD'),
                    'isMockData': False
                }
            })
        else:
            print(f'Alpaca API 调用失败: {response.status_code} - {response.text}')
            # API调用失败时返回模拟数据
            return jsonify({
                'success': True,
                'data': {
                    'accountNumber': 'PA3YPSJY0D4E',
                    'status': 'ACTIVE',
                    'cash': 100000.0,
                    'equity': 100000.0,
                    'buyingPower': 198162.55,
                    'portfolioValue': 100000.0,
                    'longMarketValue': 0.0,
                    'shortMarketValue': 0.0,
                    'patternDayTrader': False,
                    'tradingBlocked': False,
                    'transfersBlocked': False,
                    'accountBlocked': False,
                    'currency': 'USD',
                    'isMockData': True,
                    'message': f'Alpaca API 调用失败 ({response.status_code})，显示模拟数据'
                }
            })

    except Exception as e:
        print(f'Alpaca 账户接口错误: {e}')
        return jsonify({
            'success': True,
            'data': {
                'accountNumber': 'PA3YPSJY0D4E',
                'status': 'ACTIVE',
                'cash': 100000.0,
                'equity': 100000.0,
                'buyingPower': 198162.55,
                'portfolioValue': 100000.0,
                'longMarketValue': 0.0,
                'shortMarketValue': 0.0,
                'patternDayTrader': False,
                'tradingBlocked': False,
                'transfersBlocked': False,
                'accountBlocked': False,
                'currency': 'USD',
                'isMockData': True,
                'message': f'接口异常: {str(e)}，显示模拟数据'
            }
        })

@app.route('/api/ai/alpaca/positions', methods=['GET'])
def ai_alpaca_positions():
    print('=== AI Alpaca 持仓请求 ===')
    try:
        # 尝试使用真实的 Alpaca API
        environment = alpaca_config_state.get('environment', 'paper')

        if environment == 'paper':
            api_key = alpaca_config_state.get('paper_api_key')
            api_secret = alpaca_config_state.get('paper_api_secret')
            base_url = 'https://paper-api.alpaca.markets'
        else:
            api_key = alpaca_config_state.get('live_api_key')
            api_secret = alpaca_config_state.get('live_api_secret')
            base_url = 'https://api.alpaca.markets'

        # 如果没有配置API密钥，返回模拟数据但标记为模拟
        if not api_key or not api_secret:
            print('Alpaca API 密钥未配置，返回模拟持仓数据')
            return jsonify({
                'success': True,
                'data': [
                    {
                        'symbol': 'AAPL',
                        'qty': 10,
                        'avgEntryPrice': 175.50,
                        'currentPrice': 178.25,
                        'marketValue': 1782.50,
                        'unrealizedPL': 27.50,
                        'unrealizedPLPercent': 1.57,
                        'isMockData': True
                    },
                    {
                        'symbol': 'MSFT',
                        'qty': 5,
                        'avgEntryPrice': 420.75,
                        'currentPrice': 425.30,
                        'marketValue': 2126.50,
                        'unrealizedPL': 22.75,
                        'unrealizedPLPercent': 1.08,
                        'isMockData': True
                    }
                ],
                'count': 2,
                'isMockData': True,
                'message': 'Alpaca API 密钥未配置，显示模拟持仓数据'
            })

        # 调用真实的 Alpaca API
        headers = {
            'APCA-API-KEY-ID': api_key,
            'APCA-API-SECRET-KEY': api_secret
        }

        print(f'调用真实 Alpaca API: {base_url}/v2/positions')
        response = requests.get(f'{base_url}/v2/positions', headers=headers, timeout=10)

        if response.status_code == 200:
            positions_data = response.json()
            print(f'获取到真实持仓数据: {len(positions_data)} 个持仓')

            formatted_positions = []
            for position in positions_data:
                # 获取所有Alpaca原始字段
                avg_entry_price = float(position.get('avg_entry_price', 0))
                current_price = float(position.get('current_price', 0))
                qty = float(position.get('qty', 0))
                market_value = float(position.get('market_value', 0))
                cost_basis = float(position.get('cost_basis', 0))
                unrealized_pl = float(position.get('unrealized_pl', 0))
                unrealized_plpc = float(position.get('unrealized_plpc', 0))
                unrealized_intraday_pl = float(position.get('unrealized_intraday_pl', 0))
                unrealized_intraday_plpc = float(position.get('unrealized_intraday_plpc', 0))

                # 规范化字段名，同时提供驼峰式和下划线式
                formatted_position = {
                    # 基础信息
                    'symbol': position.get('symbol', ''),
                    'asset_id': position.get('asset_id', ''),
                    'asset_class': position.get('asset_class', ''),
                    'exchange': position.get('exchange', ''),
                    'asset_marginable': position.get('asset_marginable', False),

                    # 数量信息
                    'qty': qty,
                    'qty_available': float(position.get('qty_available', 0)),
                    'quantity': qty,  # 前端使用的字段
                    'side': position.get('side', 'long'),

                    # 价格信息
                    'avg_entry_price': avg_entry_price,
                    'avgEntryPrice': avg_entry_price,  # 前端使用的字段
                    'current_price': current_price,
                    'currentPrice': current_price,  # 前端使用的字段
                    'lastday_price': float(position.get('lastday_price', 0)),
                    'lastdayPrice': float(position.get('lastday_price', 0)),  # 前端使用的字段

                    # 价值信息
                    'market_value': market_value,
                    'marketValue': market_value,  # 前端使用的字段
                    'cost_basis': cost_basis,
                    'costBasis': cost_basis,  # 前端使用的字段

                    # 盈亏信息
                    'unrealized_pl': unrealized_pl,
                    'unrealizedPL': unrealized_pl,  # 前端使用的字段
                    'unrealized_plpc': unrealized_plpc,
                    'unrealizedPLPercent': unrealized_plpc * 100,  # 前端使用的字段，转换为百分比

                    # 当日盈亏信息
                    'unrealized_intraday_pl': unrealized_intraday_pl,
                    'unrealized_intraday_plpc': unrealized_intraday_plpc,
                    'unrealizedIntradayPL': unrealized_intraday_pl,  # 前端使用的字段
                    'unrealizedIntradayPLPercent': unrealized_intraday_plpc * 100,  # 前端使用的字段，转换为百分比

                    # 计算今日盈亏金额和百分比
                    'today_pl_value': unrealized_intraday_pl,
                    'todayPlValue': unrealized_intraday_pl,  # 前端使用的字段
                    'today_pl_percent': unrealized_intraday_plpc * 100,
                    'todayPlPercent': unrealized_intraday_plpc * 100,  # 前端使用的字段

                    # 总盈亏金额和百分比
                    'total_pl_value': unrealized_pl,
                    'totalPlValue': unrealized_pl,  # 前端使用的字段
                    'total_pl_percent': unrealized_plpc * 100,
                    'totalPlPercent': unrealized_plpc * 100,  # 前端使用的字段

                    # 其他Alpaca字段
                    'asset_marginable': position.get('asset_marginable', False),
                    'asset_marginable': position.get('asset_marginable', False),
                    'asset_class': position.get('asset_class', ''),
                    'exchange': position.get('exchange', ''),
                    'asset_id': position.get('asset_id', ''),
                    'avg_entry_price': avg_entry_price,
                    'change_today': float(position.get('change_today', 0)),
                    'cost_basis': cost_basis,
                    'current_price': current_price,
                    'lastday_price': float(position.get('lastday_price', 0)),
                    'market_value': market_value,
                    'qty': qty,
                    'qty_available': float(position.get('qty_available', 0)),
                    'side': position.get('side', 'long'),
                    'subtype': position.get('subtype', ''),
                    'today_pl_value': unrealized_intraday_pl,
                    'today_pl_percent': unrealized_intraday_plpc * 100,
                    'total_pl_value': unrealized_pl,
                    'total_pl_percent': unrealized_plpc * 100,
                    'unrealized_intraday_pl': unrealized_intraday_pl,
                    'unrealized_intraday_plpc': unrealized_intraday_plpc,
                    'unrealized_pl': unrealized_pl,
                    'unrealized_plpc': unrealized_plpc,

                    # 元数据
                    'isMockData': False,
                    'message': '真实Alpaca持仓数据',
                    'unrealizedIntradayPL': float(position.get('unrealized_intraday_pl', 0)),  # 前端使用的字段
                    'unrealized_intraday_plpc': float(position.get('unrealized_intraday_plpc', 0)),
                    'unrealizedIntradayPLPercent': float(position.get('unrealized_intraday_plpc', 0)) * 100,  # 前端使用的字段，转换为百分比

                    # 当日变化
                    'change_today': float(position.get('change_today', 0)),
                    'changeToday': float(position.get('change_today', 0)),  # 前端使用的字段

                    'isMockData': False
                }
                formatted_positions.append(formatted_position)

            return jsonify({
                'success': True,
                'data': formatted_positions,
                'count': len(formatted_positions),
                'isMockData': False
            })
        else:
            print(f'Alpaca 持仓 API 调用失败: {response.status_code} - {response.text}')
            # API调用失败时返回模拟数据
            return jsonify({
                'success': True,
                'data': [
                    {
                        'symbol': 'AAPL',
                        'qty': 10,
                        'avgEntryPrice': 175.50,
                        'currentPrice': 178.25,
                        'marketValue': 1782.50,
                        'unrealizedPL': 27.50,
                        'unrealizedPLPercent': 1.57,
                        'isMockData': True
                    },
                    {
                        'symbol': 'MSFT',
                        'qty': 5,
                        'avgEntryPrice': 420.75,
                        'currentPrice': 425.30,
                        'marketValue': 2126.50,
                        'unrealizedPL': 22.75,
                        'unrealizedPLPercent': 1.08,
                        'isMockData': True
                    }
                ],
                'count': 2,
                'isMockData': True,
                'message': f'Alpaca API 调用失败 ({response.status_code})，显示模拟持仓数据'
            })

    except Exception as e:
        print(f'Alpaca 持仓接口错误: {e}')
        return jsonify({
            'success': True,
            'data': [
                {
                    'symbol': 'AAPL',
                    'qty': 10,
                    'avgEntryPrice': 175.50,
                    'currentPrice': 178.25,
                    'marketValue': 1782.50,
                    'unrealizedPL': 27.50,
                    'unrealizedPLPercent': 1.57,
                    'isMockData': True
                },
                {
                    'symbol': 'MSFT',
                    'qty': 5,
                    'avgEntryPrice': 420.75,
                    'currentPrice': 425.30,
                    'marketValue': 2126.50,
                    'unrealizedPL': 22.75,
                    'unrealizedPLPercent': 1.08,
                    'isMockData': True
                }
            ],
            'count': 2,
            'isMockData': True,
            'message': f'接口异常: {str(e)}，显示模拟持仓数据'
        })

@app.route('/api/ai/alpaca/orders', methods=['GET', 'POST'])
def ai_alpaca_orders():
    if request.method == 'POST':
        return ai_alpaca_place_order()

    # GET 请求处理原有逻辑
    import sys
    print('=== AI Alpaca 订单请求 ===', file=sys.stderr)
    print('=== AI Alpaca 订单请求 ===')
    status = request.args.get('status', 'open')
    limit = request.args.get('limit', '50')

    try:
        # 尝试使用真实的 Alpaca API
        environment = alpaca_config_state.get('environment', 'paper')

        if environment == 'paper':
            api_key = alpaca_config_state.get('paper_api_key')
            api_secret = alpaca_config_state.get('paper_api_secret')
            base_url = 'https://paper-api.alpaca.markets'
        else:
            api_key = alpaca_config_state.get('live_api_key')
            api_secret = alpaca_config_state.get('live_api_secret')
            base_url = 'https://api.alpaca.markets'

        # 如果没有配置API密钥，返回模拟数据但标记为模拟
        if not api_key or not api_secret:
            print('Alpaca API 密钥未配置，返回模拟订单数据')
            response = {
                'success': True,
                'data': [
                    {
                        'id': 'order-002',
                        'symbol': 'NVDA',
                        'qty': 2,
                        'filled_qty': 0,
                        'filledQty': 0,
                        'side': 'buy',
                        'type': 'limit',
                        'limit_price': 950.00,
                        'limitPrice': 950.00,
                        'status': 'accepted',
                        'created_at': '2026-04-05T10:30:00Z',
                        'createdAt': '2026-04-05T10:30:00Z',
                        'time_in_force': 'gtc',
                        'timeInForce': 'gtc',
                        'isMockData': True
                    },
                    {
                        'id': 'order-003',
                        'symbol': 'GOOGL',
                        'qty': 3,
                        'filled_qty': 0,
                        'filledQty': 0,
                        'side': 'buy',
                        'type': 'market',
                        'status': 'accepted',
                        'created_at': '2026-04-05T11:15:00Z',
                        'createdAt': '2026-04-05T11:15:00Z',
                        'time_in_force': 'day',
                        'timeInForce': 'day',
                        'isMockData': True
                    }
                ],
                'count': 2,
                'status_filter': status,
                'limit': limit,
                'isMockData': True,
                'message': 'Alpaca API 密钥未配置，显示模拟订单数据'
            }
            print('返回模拟订单数据 (status=%s, limit=%s)' % (status, limit))
            return jsonify(response)

        # 调用真实的 Alpaca API
        headers = {
            'APCA-API-KEY-ID': api_key,
            'APCA-API-SECRET-KEY': api_secret
        }

        # 构建查询参数
        params = {
            'status': status,
            'limit': limit,
            'direction': 'desc',
            'nested': 'true'  # 添加nested参数
        }

        print(f'调用真实 Alpaca API: {base_url}/v2/orders')
        print(f'查询参数: {params}')
        print(f'环境: {environment}')
        print(f'API密钥: {api_key[:6]}...{api_key[-4:]}')
        print(f'API Secret: {api_secret[:6]}...{api_secret[-4:]}')

        # 先调用/v2/account获取账户信息
        try:
            account_response = requests.get(f'{base_url}/v2/account', headers=headers, timeout=10)
            if account_response.status_code == 200:
                account_data = account_response.json()
                print(f'账户信息: account_number={account_data.get("account_number")}, id={account_data.get("id")}')
            else:
                print(f'获取账户信息失败: {account_response.status_code}')
        except Exception as e:
            print(f'获取账户信息异常: {e}')

        try:
            response = requests.get(f'{base_url}/v2/orders', headers=headers, params=params, timeout=10)

            print(f'Alpaca API 响应状态码: {response.status_code}')
            print(f'Alpaca API 响应内容前500字符: {response.text[:500]}...')

            if response.status_code == 200:
                orders_data = response.json()
                print(f'获取到真实订单数据: {len(orders_data)} 个订单')

                # 如果Alpaca返回空数组，直接返回空数组
                if len(orders_data) == 0:
                    print('Alpaca API 返回空订单数据，返回空数组')
                    return jsonify({
                        'success': True,
                        'data': [],
                        'count': 0,
                        'limit': limit,
                        'status_filter': status,
                        'isMockData': False,
                        'message': 'Alpaca账户没有订单'
                    })

                # 处理真实数据
                formatted_orders = []
                for order in orders_data:
                    # 规范化字段名，同时提供驼峰式和下划线式
                    formatted_order = {
                        'id': order.get('id', ''),
                        'symbol': order.get('symbol', ''),
                        'qty': float(order.get('qty', 0)) if order.get('qty') else 0,
                        'quantity': float(order.get('qty', 0)) if order.get('qty') else 0,  # 前端使用的字段
                        'filled_qty': float(order.get('filled_qty', 0)) if order.get('filled_qty') else 0,
                        'filledQty': float(order.get('filled_qty', 0)) if order.get('filled_qty') else 0,  # 前端使用的字段
                        'side': order.get('side', ''),
                        'type': order.get('type', ''),
                        'limit_price': float(order.get('limit_price', 0)) if order.get('limit_price') else None,
                        'limitPrice': float(order.get('limit_price', 0)) if order.get('limit_price') else None,  # 前端使用的字段
                        'filled_avg_price': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,
                        'filledAvgPrice': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,  # 前端使用的字段
                        'status': order.get('status', ''),
                        # 时间字段 - 优先级: submitted_at > created_at > updated_at
                        'submitted_at': order.get('submitted_at', order.get('created_at', '')),
                        'submittedAt': order.get('submitted_at', order.get('created_at', '')),  # 前端使用的字段
                        'created_at': order.get('created_at', ''),
                        'createdAt': order.get('created_at', ''),  # 前端使用的字段
                        'updated_at': order.get('updated_at', ''),
                        'updatedAt': order.get('updated_at', ''),  # 前端使用的字段
                        'filled_at': order.get('filled_at', ''),
                        'filledAt': order.get('filled_at', ''),  # 前端使用的字段
                        'canceled_at': order.get('canceled_at', ''),
                        'canceledAt': order.get('canceled_at', ''),  # 前端使用的字段
                        'time_in_force': order.get('time_in_force', ''),
                        'timeInForce': order.get('time_in_force', ''),  # 前端使用的字段
                        'isMockData': False  # 真实数据
                    }
                    formatted_orders.append(formatted_order)

                return jsonify({
                    'success': True,
                    'data': formatted_orders,
                    'count': len(formatted_orders),
                    'status_filter': status,
                    'limit': limit,
                    'isMockData': False
                })
            else:
                print(f'Alpaca 订单 API 调用失败: {response.status_code} - {response.text}')
                # API调用失败时返回空数据
                return jsonify({
                    'success': True,
                    'data': [],
                    'count': 0,
                    'limit': limit,
                    'status_filter': status,
                    'isMockData': False,
                    'message': f'Alpaca API 调用失败 ({response.status_code})'
                })

        except Exception as e:
            print(f'Alpaca API 调用异常: {e}')
            import traceback
            traceback.print_exc()
            # API调用失败时返回空数据
            return jsonify({
                'success': True,
                'data': [],
                'count': 0,
                'limit': limit,
                'status_filter': status,
                'isMockData': False,
                'message': f'Alpaca API 调用异常: {str(e)}'
            })
            formatted_orders = []
            for order in orders_data:
                # 规范化字段名，同时提供驼峰式和下划线式
                formatted_order = {
                    'id': order.get('id', ''),
                    'symbol': order.get('symbol', ''),
                    'qty': float(order.get('qty', 0)),
                    'quantity': float(order.get('qty', 0)),  # 前端使用的字段
                    'filled_qty': float(order.get('filled_qty', 0)),
                    'filledQty': float(order.get('filled_qty', 0)),  # 前端使用的字段
                    'side': order.get('side', ''),
                    'type': order.get('type', ''),
                    'limit_price': float(order.get('limit_price', 0)) if order.get('limit_price') else None,
                    'limitPrice': float(order.get('limit_price', 0)) if order.get('limit_price') else None,  # 前端使用的字段
                    'filled_avg_price': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,
                    'filledAvgPrice': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,  # 前端使用的字段
                    'status': order.get('status', ''),
                    # 时间字段 - 优先级: submitted_at > created_at > updated_at
                    'submitted_at': order.get('submitted_at', order.get('created_at', '')),
                    'submittedAt': order.get('submitted_at', order.get('created_at', '')),  # 前端使用的字段
                    'created_at': order.get('created_at', ''),
                    'createdAt': order.get('created_at', ''),  # 前端使用的字段
                    'updated_at': order.get('updated_at', ''),
                    'updatedAt': order.get('updated_at', ''),  # 前端使用的字段
                    'filled_at': order.get('filled_at', ''),
                    'filledAt': order.get('filled_at', ''),  # 前端使用的字段
                    'canceled_at': order.get('canceled_at', ''),
                    'canceledAt': order.get('canceled_at', ''),  # 前端使用的字段
                    'time_in_force': order.get('time_in_force', ''),
                    'timeInForce': order.get('time_in_force', ''),  # 前端使用的字段
                    'isMockData': len(orders_data) > 0 and orders_data[0].get('id', '').startswith('test-open-order-')  # 如果是测试数据，标记为模拟
                }
                formatted_orders.append(formatted_order)

            return jsonify({
                'success': True,
                'data': formatted_orders,
                'count': len(formatted_orders),
                'status_filter': status,
                'limit': limit,
                'isMockData': len(formatted_orders) > 0 and formatted_orders[0].get('isMockData', False)
            })
        else:
            print(f'Alpaca 订单 API 调用失败: {response.status_code} - {response.text}')
            # API调用失败时返回模拟数据
            response = {
                'success': True,
                'data': [
                    {
                        'id': 'order-002',
                        'symbol': 'NVDA',
                        'qty': 2,
                        'filled_qty': 0,
                        'filledQty': 0,
                        'side': 'buy',
                        'type': 'limit',
                        'limit_price': 950.00,
                        'limitPrice': 950.00,
                        'status': 'accepted',
                        'created_at': '2026-04-05T10:30:00Z',
                        'createdAt': '2026-04-05T10:30:00Z',
                        'time_in_force': 'gtc',
                        'timeInForce': 'gtc',
                        'isMockData': True
                    },
                    {
                        'id': 'order-003',
                        'symbol': 'GOOGL',
                        'qty': 3,
                        'filled_qty': 0,
                        'filledQty': 0,
                        'side': 'buy',
                        'type': 'market',
                        'status': 'accepted',
                        'created_at': '2026-04-05T11:15:00Z',
                        'createdAt': '2026-04-05T11:15:00Z',
                        'time_in_force': 'day',
                        'timeInForce': 'day',
                        'isMockData': True
                    }
                ],
                'count': 2,
                'status_filter': status,
                'limit': limit,
                'isMockData': True,
                'message': f'Alpaca API 调用失败 ({response.status_code})，显示模拟订单数据'
            }
            return jsonify(response)

    except Exception as e:
        print(f'Alpaca 订单接口错误: {e}')
        response = {
            'success': True,
            'data': [
                {
                    'id': 'order-002',
                    'symbol': 'NVDA',
                    'qty': 2,
                    'filled_qty': 0,
                    'filledQty': 0,
                    'side': 'buy',
                    'type': 'limit',
                    'limit_price': 950.00,
                    'limitPrice': 950.00,
                    'status': 'accepted',
                    'created_at': '2026-04-05T10:30:00Z',
                    'createdAt': '2026-04-05T10:30:00Z',
                    'time_in_force': 'gtc',
                    'timeInForce': 'gtc',
                    'isMockData': True
                },
                {
                    'id': 'order-003',
                    'symbol': 'GOOGL',
                    'qty': 3,
                    'filled_qty': 0,
                    'filledQty': 0,
                    'side': 'buy',
                    'type': 'market',
                    'status': 'accepted',
                    'created_at': '2026-04-05T11:15:00Z',
                    'createdAt': '2026-04-05T11:15:00Z',
                    'time_in_force': 'day',
                    'timeInForce': 'day',
                    'isMockData': True
                }
            ],
            'count': 2,
            'status_filter': status,
            'limit': limit,
            'isMockData': True,
            'message': f'接口异常: {str(e)}，显示模拟订单数据'
        }
        return jsonify(response)

def ai_alpaca_place_order():
    """处理 Alpaca 下单请求"""
    import sys
    print('=== AI Alpaca 下单请求 ===', file=sys.stderr)
    print('=== AI Alpaca 下单请求 ===')

    try:
        # 获取订单数据
        data = request.get_json()
        print(f'下单数据: {data}')

        # 验证必要字段
        required_fields = ['symbol', 'side', 'qty', 'type']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400

        # 尝试使用真实的 Alpaca API
        environment = alpaca_config_state.get('environment', 'paper')

        if environment == 'paper':
            api_key = alpaca_config_state.get('paper_api_key')
            api_secret = alpaca_config_state.get('paper_api_secret')
            base_url = 'https://paper-api.alpaca.markets'
        else:
            api_key = alpaca_config_state.get('live_api_key')
            api_secret = alpaca_config_state.get('live_api_secret')
            base_url = 'https://api.alpaca.markets'

        # 检查API密钥
        if not api_key or not api_secret:
            print('Alpaca API 密钥未配置，无法下单')
            return jsonify({
                'success': False,
                'error': 'Alpaca API keys not configured'
            }), 400

        # 构建 Alpaca API 请求
        import requests

        headers = {
            'APCA-API-KEY-ID': api_key,
            'APCA-API-SECRET-KEY': api_secret,
            'Content-Type': 'application/json'
        }

        # 构建订单请求体
        order_payload = {
            'symbol': data['symbol'].upper(),
            'side': data['side'],
            'qty': str(data['qty']),
            'type': data['type'],
            'time_in_force': data.get('time_in_force', 'day')
        }

        # 添加可选字段
        if data['type'] == 'limit' and 'limit_price' in data:
            order_payload['limit_price'] = str(data['limit_price'])

        print(f'发送到 Alpaca 的订单: {order_payload}')

        # 发送下单请求
        response = requests.post(
            f'{base_url}/v2/orders',
            headers=headers,
            json=order_payload,
            timeout=30
        )

        print(f'Alpaca API 响应状态: {response.status_code}')
        print(f'Alpaca API 响应内容: {response.text}')

        if response.status_code == 200:
            order_data = response.json()
            print(f'下单成功，订单ID: {order_data.get("id")}')

            return jsonify({
                'success': True,
                'order': order_data,
                'message': 'Order placed successfully'
            })
        else:
            error_msg = f'Alpaca API error: {response.status_code} - {response.text}'
            print(error_msg)
            return jsonify({
                'success': False,
                'error': error_msg
            }), 400

    except Exception as e:
        error_msg = f'下单异常: {str(e)}'
        print(error_msg)
        import traceback
        traceback.print_exc()

        return jsonify({
            'success': False,
            'error': error_msg
        }), 500

@app.route('/api/ai/alpaca/orders/history', methods=['GET'])
def ai_alpaca_orders_history():
    import sys
    print('=== AI Alpaca 历史订单请求 ===', file=sys.stderr)
    print('=== AI Alpaca 历史订单请求 ===')
    limit = request.args.get('limit', '50')
    status = request.args.get('status', 'all')

    try:
        # 尝试使用真实的 Alpaca API
        environment = alpaca_config_state.get('environment', 'paper')

        if environment == 'paper':
            api_key = alpaca_config_state.get('paper_api_key')
            api_secret = alpaca_config_state.get('paper_api_secret')
            base_url = 'https://paper-api.alpaca.markets'
        else:
            api_key = alpaca_config_state.get('live_api_key')
            api_secret = alpaca_config_state.get('live_api_secret')
            base_url = 'https://api.alpaca.markets'

        # 如果没有配置API密钥，返回空数据
        if not api_key or not api_secret:
            print('=== DEBUG: Alpaca API 密钥检查 ===')
            print(f'API Key 存在: {bool(api_key)}')
            print(f'API Secret 存在: {bool(api_secret)}')
            print(f'环境: {environment}')
            print(f'API Key 前10位: {api_key[:10] if api_key else "N/A"}')
            print('=== DEBUG 结束 ===')
            print('Alpaca API 密钥未配置，返回空数据')
            response = {
                'success': True,
                'data': [],
                'count': 0,
                'limit': limit,
                'status_filter': status,
                'isMockData': False,
                'message': 'Alpaca API 密钥未配置'
            }
            return jsonify(response)

        # 调用真实的 Alpaca API
        headers = {
            'APCA-API-KEY-ID': api_key,
            'APCA-API-SECRET-KEY': api_secret
        }

        # 构建查询参数 - 使用最简单的参数
        params = {
            'limit': min(int(limit), 100),  # Alpaca最大限制100
            'direction': 'desc',
            'status': status  # 总是添加status参数，包括'all'
        }

        print(f'调用真实 Alpaca API 获取历史订单: {base_url}/v2/orders')
        print(f'查询参数: {params}')
        print(f'环境: {environment}')
        print(f'API密钥: {api_key[:6]}...{api_key[-4:]}')
        print(f'API Secret: {api_secret[:6]}...{api_secret[-4:]}')

        # 先调用/v2/account获取账户信息
        try:
            account_response = requests.get(f'{base_url}/v2/account', headers=headers, timeout=10)
            if account_response.status_code == 200:
                account_data = account_response.json()
                print(f'账户信息: account_number={account_data.get("account_number")}, id={account_data.get("id")}')
            else:
                print(f'获取账户信息失败: {account_response.status_code}')
        except Exception as e:
            print(f'获取账户信息异常: {e}')

        try:
            response = requests.get(f'{base_url}/v2/orders', headers=headers, params=params, timeout=10)

            print(f'Alpaca API 响应状态码: {response.status_code}')
            print(f'Alpaca API 响应内容前500字符: {response.text[:500]}...')

            if response.status_code == 200:
                orders_data = response.json()
                print(f'获取到真实历史订单数据: {len(orders_data)} 个订单')

                # 如果Alpaca返回空数组，直接返回空数组
                if len(orders_data) == 0:
                    print('Alpaca API 返回空订单数据，返回空数组')
                    return jsonify({
                        'success': True,
                        'data': [],
                        'count': 0,
                        'limit': limit,
                        'status_filter': status,
                        'isMockData': False,
                        'message': 'Alpaca账户没有历史订单'
                    })

                # 处理真实数据
                formatted_orders = []
                for order in orders_data:
                    # 规范化字段名，同时提供驼峰式和下划线式
                    formatted_order = {
                        'id': order.get('id', ''),
                        'symbol': order.get('symbol', ''),
                        'qty': float(order.get('qty', 0)) if order.get('qty') else 0,
                        'quantity': float(order.get('qty', 0)) if order.get('qty') else 0,  # 前端使用的字段
                        'filled_qty': float(order.get('filled_qty', 0)) if order.get('filled_qty') else 0,
                        'filledQty': float(order.get('filled_qty', 0)) if order.get('filled_qty') else 0,  # 前端使用的字段
                        'side': order.get('side', ''),
                        'type': order.get('type', ''),
                        'limit_price': float(order.get('limit_price', 0)) if order.get('limit_price') else None,
                        'limitPrice': float(order.get('limit_price', 0)) if order.get('limit_price') else None,  # 前端使用的字段
                        'filled_avg_price': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,
                        'filledAvgPrice': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,  # 前端使用的字段
                        'status': order.get('status', ''),
                        # 时间字段 - 优先级: submitted_at > created_at > updated_at
                        'submitted_at': order.get('submitted_at', order.get('created_at', '')),
                        'submittedAt': order.get('submitted_at', order.get('created_at', '')),  # 前端使用的字段
                        'created_at': order.get('created_at', ''),
                        'createdAt': order.get('created_at', ''),  # 前端使用的字段
                        'updated_at': order.get('updated_at', ''),
                        'updatedAt': order.get('updated_at', ''),  # 前端使用的字段
                        'filled_at': order.get('filled_at', ''),
                        'filledAt': order.get('filled_at', ''),  # 前端使用的字段
                        'canceled_at': order.get('canceled_at', ''),
                        'canceledAt': order.get('canceled_at', ''),  # 前端使用的字段
                        'time_in_force': order.get('time_in_force', ''),
                        'timeInForce': order.get('time_in_force', ''),  # 前端使用的字段
                        'isMockData': False  # 真实数据
                    }
                    formatted_orders.append(formatted_order)

                return jsonify({
                    'success': True,
                    'data': formatted_orders,
                    'count': len(formatted_orders),
                    'limit': limit,
                    'status_filter': status,
                    'isMockData': False
                })
            else:
                print(f'Alpaca 历史订单 API 调用失败: {response.status_code} - {response.text}')
                # API调用失败时返回空数据
                return jsonify({
                    'success': True,
                    'data': [],
                    'count': 0,
                    'limit': limit,
                    'status_filter': status,
                    'isMockData': False,
                    'message': f'Alpaca API 调用失败 ({response.status_code})'
                })

        except Exception as e:
            print(f'Alpaca API 调用异常: {e}')
            import traceback
            traceback.print_exc()
            # API调用失败时返回空数据
            return jsonify({
                'success': True,
                'data': [],
                'count': 0,
                'limit': limit,
                'status_filter': status,
                'isMockData': False,
                'message': f'Alpaca API 调用异常: {str(e)}'
            })



            formatted_orders = []
            for order in orders_data:
                # 规范化字段名，同时提供驼峰式和下划线式
                formatted_order = {
                    'id': order.get('id', ''),
                    'symbol': order.get('symbol', ''),
                    'qty': float(order.get('qty', 0)),
                    'quantity': float(order.get('qty', 0)),  # 前端使用的字段
                    'filled_qty': float(order.get('filled_qty', 0)),
                    'filledQty': float(order.get('filled_qty', 0)),  # 前端使用的字段
                    'side': order.get('side', ''),
                    'type': order.get('type', ''),
                    'limit_price': float(order.get('limit_price', 0)) if order.get('limit_price') else None,
                    'limitPrice': float(order.get('limit_price', 0)) if order.get('limit_price') else None,  # 前端使用的字段
                    'filled_avg_price': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,
                    'filledAvgPrice': float(order.get('filled_avg_price', 0)) if order.get('filled_avg_price') else None,  # 前端使用的字段
                    'status': order.get('status', ''),
                    # 时间字段 - 优先级: submitted_at > created_at > updated_at
                    'submitted_at': order.get('submitted_at', order.get('created_at', '')),
                    'submittedAt': order.get('submitted_at', order.get('created_at', '')),  # 前端使用的字段
                    'created_at': order.get('created_at', ''),
                    'createdAt': order.get('created_at', ''),  # 前端使用的字段
                    'updated_at': order.get('updated_at', ''),
                    'updatedAt': order.get('updated_at', ''),  # 前端使用的字段
                    'filled_at': order.get('filled_at', ''),
                    'filledAt': order.get('filled_at', ''),  # 前端使用的字段
                    'canceled_at': order.get('canceled_at', ''),
                    'canceledAt': order.get('canceled_at', ''),  # 前端使用的字段
                    'time_in_force': order.get('time_in_force', ''),
                    'timeInForce': order.get('time_in_force', ''),  # 前端使用的字段
                    'isMockData': len(orders_data) > 0 and orders_data[0].get('id', '').startswith('test-order-')  # 如果是测试数据，标记为模拟
                }
                formatted_orders.append(formatted_order)

            return jsonify({
                'success': True,
                'data': formatted_orders,
                'count': len(formatted_orders),
                'limit': limit,
                'status_filter': status,
                'isMockData': len(formatted_orders) > 0 and formatted_orders[0].get('isMockData', False)
            })
        else:
            print(f'Alpaca 历史订单 API 调用失败: {response.status_code} - {response.text}')
            # API调用失败时返回模拟数据
            import random
            import datetime
            data = []

            # 生成更真实的模拟数据
            statuses = ['filled', 'canceled', 'expired', 'rejected', 'accepted', 'pending_new', 'pending_cancel', 'stopped', 'suspended', 'calculated']
            sides = ['buy', 'sell']
            types = ['market', 'limit', 'stop', 'stop_limit']
            symbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'AMZN', 'META', 'NFLX', 'AMD', 'INTC']

            for i in range(min(int(limit), 30)):
                symbol = symbols[i % len(symbols)]
                qty = (i % 20) + 1
                filled_qty = qty if i % 4 == 0 else (qty // 2 if i % 3 == 0 else 0)
                status_idx = i % len(statuses)
                order_status = statuses[status_idx]

                # 生成更真实的时间戳
                days_ago = i % 30
                hours_ago = i % 24
                minutes_ago = i % 60
                created_at = (datetime.datetime.now() - datetime.timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)).isoformat() + 'Z'

                data.append({
                    'id': f'order-{i:04d}',
                    'symbol': symbol,
                    'qty': qty,
                    'quantity': qty,  # 前端使用的字段
                    'filled_qty': filled_qty,
                    'filledQty': filled_qty,  # 前端使用的字段
                    'side': sides[i % 2],
                    'type': types[i % len(types)],
                    'limit_price': 100.0 + (i * 5) if i % 3 != 0 else None,
                    'limitPrice': 100.0 + (i * 5) if i % 3 != 0 else None,  # 前端使用的字段
                    'status': order_status,
                    'created_at': created_at,
                    'createdAt': created_at,  # 前端使用的字段
                    'time_in_force': 'gtc',
                    'timeInForce': 'gtc',  # 前端使用的字段
                    'isMockData': True
                })

            response = {
                'success': True,
                'data': data,
                'count': len(data),
                'limit': limit,
                'status_filter': status,
                'isMockData': True,
                'message': f'Alpaca API 调用失败 ({response.status_code})，显示模拟历史订单数据'
            }
            return jsonify(response)

    except Exception as e:
        print(f'Alpaca 历史订单接口错误: {e}')
        import random
        import datetime
        data = []

        # 生成更真实的模拟数据
        statuses = ['filled', 'canceled', 'expired', 'rejected', 'accepted', 'pending_new', 'pending_cancel', 'stopped', 'suspended', 'calculated']
        sides = ['buy', 'sell']
        types = ['market', 'limit', 'stop', 'stop_limit']
        symbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 'AMZN', 'META', 'NFLX', 'AMD', 'INTC']

        for i in range(min(int(limit), 30)):
            symbol = symbols[i % len(symbols)]
            qty = (i % 20) + 1
            filled_qty = qty if i % 4 == 0 else (qty // 2 if i % 3 == 0 else 0)
            status_idx = i % len(statuses)
            order_status = statuses[status_idx]

            # 生成更真实的时间戳
            days_ago = i % 30
            hours_ago = i % 24
            minutes_ago = i % 60
            created_at = (datetime.datetime.now() - datetime.timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)).isoformat() + 'Z'

            data.append({
                'id': f'order-{i:04d}',
                'symbol': symbol,
                'qty': qty,
                'quantity': qty,  # 前端使用的字段
                'filled_qty': filled_qty,
                'filledQty': filled_qty,  # 前端使用的字段
                'side': sides[i % 2],
                'type': types[i % len(types)],
                'limit_price': 100.0 + (i * 5) if i % 3 != 0 else None,
                'limitPrice': 100.0 + (i * 5) if i % 3 != 0 else None,  # 前端使用的字段
                'status': order_status,
                'created_at': created_at,
                'createdAt': created_at,  # 前端使用的字段
                'time_in_force': 'gtc',
                'timeInForce': 'gtc',  # 前端使用的字段
                'isMockData': True
            })

        response = {
            'success': True,
            'data': data,
            'count': len(data),
            'limit': limit,
            'status_filter': status,
            'isMockData': True,
            'message': f'接口异常: {str(e)}，显示模拟历史订单数据'
        }
        return jsonify(response)

@app.route('/api/ai/chat', methods=['POST'])
def ai_chat():
    print('=== AI Chat 请求 ===')
    try:
        data = request.get_json()
        message = data.get('message', '')
        symbol = data.get('symbol', '')
        history = data.get('history', [])

        print(f'收到消息: {message}')
        print(f'符号: {symbol}')
        print(f'历史记录长度: {len(history)}')

        # 检查是否有有效的 API 密钥
        api_key = ai_provider_config_state.get('apiKey', '')

        if not api_key or api_key.startswith('sk-') and len(api_key) < 30:
            # 没有有效 API 密钥，返回模拟回复
            print('没有有效的 DeepSeek API 密钥，返回模拟回复')
            ai_response = get_mock_response(message)
            return jsonify({
                'success': True,
                'response': ai_response,
                'timestamp': time.time(),
                'strategy_updated': False,
                'new_strategy_state': None,
                'isMockResponse': True,
                'message': 'DeepSeek API 密钥未配置或无效，返回模拟回复'
            })

        # 如果有有效的 API 密钥，调用真实的 DeepSeek API
        print(f'使用 API 密钥调用 DeepSeek: {api_key[:10]}...')

        # 构建请求
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

        # 构建消息历史
        messages = []
        # 添加历史消息
        for h in history[-10:]:  # 只保留最近10条历史
            if h.get('role') == 'user':
                messages.append({'role': 'user', 'content': h.get('content', '')})
            elif h.get('role') == 'ai':
                messages.append({'role': 'assistant', 'content': h.get('content', '')})

        # 添加当前消息
        messages.append({'role': 'user', 'content': message})

        # 构建请求体
        payload = {
            'model': ai_provider_config_state.get('model', 'deepseek-chat'),
            'messages': messages,
            'max_tokens': 1000,
            'temperature': 0.7
        }

        base_url = ai_provider_config_state.get('baseURL', 'https://api.deepseek.com')
        if not base_url.startswith('http'):
            base_url = 'https://' + base_url

        # 调用 DeepSeek API
        try:
            response = requests.post(
                f'{base_url}/chat/completions',
                headers=headers,
                json=payload,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                ai_response = result['choices'][0]['message']['content']
                print(f'DeepSeek API 调用成功，返回真实回复')

                return jsonify({
                    'success': True,
                    'response': ai_response,
                    'timestamp': time.time(),
                    'strategy_updated': False,
                    'new_strategy_state': None,
                    'isMockResponse': False,
                    'message': 'DeepSeek API 调用成功'
                })
            else:
                print(f'DeepSeek API 调用失败: {response.status_code} - {response.text}')
                # API调用失败时返回模拟回复
                ai_response = get_mock_response(message)
                return jsonify({
                    'success': True,
                    'response': ai_response,
                    'timestamp': time.time(),
                    'strategy_updated': False,
                    'new_strategy_state': None,
                    'isMockResponse': True,
                    'message': f'DeepSeek API 调用失败 ({response.status_code})，返回模拟回复'
                })

        except Exception as api_error:
            print(f'DeepSeek API 调用异常: {api_error}')
            # API调用异常时返回模拟回复
            ai_response = get_mock_response(message)
            return jsonify({
                'success': True,
                'response': ai_response,
                'timestamp': time.time(),
                'strategy_updated': False,
                'new_strategy_state': None,
                'isMockResponse': True,
                'message': f'DeepSeek API 调用异常: {str(api_error)[:100]}'
            })

    except Exception as e:
        print(f'AI Chat 错误: {e}')
        # 异常时返回模拟回复
        ai_response = f"处理消息时发生错误，当前为模拟回复。\n错误: {str(e)[:100]}"
        return jsonify({
            'success': True,
            'response': ai_response,
            'timestamp': time.time(),
            'strategy_updated': False,
            'new_strategy_state': None,
            'isMockResponse': True
        })

# ==================== AI Trading 分析接口 ====================

@app.route('/api/ai/trade/preview', methods=['POST'])
def ai_trade_preview():
    print('=== AI Trade Preview 请求 ===')
    try:
        data = request.get_json()
        symbol = data.get('symbol', 'AAPL')

        print(f'收到交易预览请求: {symbol}')

        # 检查是否有有效的 API 密钥
        api_key = ai_provider_config_state.get('apiKey', '')

        if not api_key or api_key.startswith('sk-') and len(api_key) < 30:
            # 没有有效 API 密钥，返回错误
            print('没有有效的 DeepSeek API 密钥，无法进行 AI 分析')
            return jsonify({
                'success': False,
                'validation': {
                    'is_valid': False,
                    'message': 'DeepSeek API 密钥未配置，无法进行 AI 分析'
                },
                'decision': {
                    'action': 'HOLD',
                    'symbol': symbol,
                    'qty': 0,
                    'confidence': 0,
                    'reason': 'AI 分析不可用：请配置 DeepSeek API 密钥',
                    'executable': False
                }
            })

        # 如果有有效的 API 密钥，调用 DeepSeek 进行交易分析
        print(f'使用 API 密钥进行交易分析: {api_key[:10]}...')

        # 构建请求
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

        # 构建分析提示
        analysis_prompt = f"""作为量化交易AI助手，请分析股票{symbol}的当前交易机会。

请提供：
1. 交易建议（BUY/SELL/HOLD）
2. 建议数量
3. 置信度（0-100%）
4. 简要理由
5. 是否可执行（基于风险检查）

请以JSON格式返回，包含以下字段：
- action: "BUY", "SELL", 或 "HOLD"
- symbol: 股票代码
- qty: 建议数量
- confidence: 置信度（0-1）
- reason: 简要理由
- executable: true/false
"""

        payload = {
            'model': ai_provider_config_state.get('model', 'deepseek-chat'),
            'messages': [{'role': 'user', 'content': analysis_prompt}],
            'max_tokens': 500,
            'temperature': 0.3
        }

        base_url = ai_provider_config_state.get('baseURL', 'https://api.deepseek.com')
        if not base_url.startswith('http'):
            base_url = 'https://' + base_url

        # 调用 DeepSeek API
        try:
            response = requests.post(
                f'{base_url}/chat/completions',
                headers=headers,
                json=payload,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                ai_response = result['choices'][0]['message']['content']
                print(f'DeepSeek 交易分析成功')

                # 解析 AI 响应（简化处理）
                import re
                import json as json_module

                try:
                    # 尝试从响应中提取 JSON
                    json_match = re.search(r'\{.*\}', ai_response, re.DOTALL)
                    if json_match:
                        decision_data = json_module.loads(json_match.group())
                    else:
                        # 如果找不到 JSON，创建默认决策
                        decision_data = {
                            'action': 'HOLD',
                            'symbol': symbol,
                            'qty': 0,
                            'confidence': 0.5,
                            'reason': ai_response[:200],
                            'executable': False
                        }
                except:
                    # 解析失败，创建默认决策
                    decision_data = {
                        'action': 'HOLD',
                        'symbol': symbol,
                        'qty': 0,
                        'confidence': 0.5,
                        'reason': 'AI 分析完成，但解析响应失败',
                        'executable': False
                    }

                return jsonify({
                    'success': True,
                    'decision': decision_data,
                    'validation': {
                        'is_valid': True,
                        'message': 'AI 分析完成'
                    },
                    'risk_checks': {
                        'passed': ['ai_analysis_completed'],
                        'blocked': [],
                        'executable': decision_data.get('executable', False)
                    },
                    'history_id': int(time.time())
                })
            else:
                print(f'DeepSeek API 调用失败: {response.status_code}')
                return jsonify({
                    'success': False,
                    'validation': {
                        'is_valid': False,
                        'message': f'AI 分析失败: DeepSeek API 错误 ({response.status_code})'
                    },
                    'decision': {
                        'action': 'HOLD',
                        'symbol': symbol,
                        'qty': 0,
                        'confidence': 0,
                        'reason': 'AI 分析服务暂时不可用',
                        'executable': False
                    }
                })

        except Exception as api_error:
            print(f'DeepSeek API 调用异常: {api_error}')
            return jsonify({
                'success': False,
                'validation': {
                    'is_valid': False,
                    'message': f'AI 分析失败: {str(api_error)[:100]}'
                },
                'decision': {
                    'action': 'HOLD',
                    'symbol': symbol,
                    'qty': 0,
                    'confidence': 0,
                    'reason': 'AI 分析服务异常',
                    'executable': False
                }
            })

    except Exception as e:
        print(f'AI Trade Preview 错误: {e}')
        return jsonify({
            'success': False,
            'validation': {
                'is_valid': False,
                'message': f'处理请求时发生错误: {str(e)[:100]}'
            },
            'decision': {
                'action': 'HOLD',
                'symbol': 'UNKNOWN',
                'qty': 0,
                'confidence': 0,
                'reason': '处理请求时发生错误',
                'executable': False
            }
        })

@app.route('/api/ai/trade/analyze-with-context', methods=['POST'])
def ai_trade_analyze_with_context():
    print('=== AI Trade Analyze with Context 请求 ===')
    try:
        data = request.get_json()
        symbol = data.get('symbol', 'AAPL')
        context = data.get('context', {})

        print(f'收到带上下文的AI分析请求: {symbol}')
        print(f'上下文数据摘要:')
        print(f'  - 账户快照: {context.get("accountSnapshot", {}).get("portfolioValue", "N/A")}')
        print(f'  - 持仓数量: {len(context.get("positions", []))}')
        print(f'  - 未平仓订单: {len(context.get("openOrders", []))}')
        print(f'  - 订单历史: {len(context.get("orderHistory", []))}')
        print(f'  - 交易环境: {context.get("tradingEnvironment", "paper")}')

        # 检查是否有有效的 API 密钥
        api_key = ai_provider_config_state.get('apiKey', '')

        if not api_key or api_key.startswith('sk-') and len(api_key) < 30:
            # 没有有效 API 密钥，返回基于上下文的简单分析
            print('没有有效的 DeepSeek API 密钥，使用上下文进行简单分析')
            return generate_context_based_analysis(symbol, context)

        # 如果有有效的 API 密钥，调用 DeepSeek 进行带上下文的交易分析
        print(f'使用 API 密钥进行带上下文的交易分析: {api_key[:10]}...')

        # 构建请求
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

        # 构建详细的上下文分析提示
        analysis_prompt = build_context_analysis_prompt(symbol, context)

        payload = {
            'model': ai_provider_config_state.get('model', 'deepseek-chat'),
            'messages': [{'role': 'user', 'content': analysis_prompt}],
            'max_tokens': 1000,
            'temperature': 0.2,
            'response_format': {'type': 'json_object'}
        }

        base_url = ai_provider_config_state.get('baseURL', 'https://api.deepseek.com')
        if not base_url.startswith('http'):
            base_url = 'https://' + base_url

        # 调用 DeepSeek API
        try:
            response = requests.post(
                f'{base_url}/chat/completions',
                headers=headers,
                json=payload,
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                ai_response = result['choices'][0]['message']['content']
                print(f'DeepSeek 带上下文分析成功')

                # 解析 AI 响应为 JSON
                import json as json_module
                try:
                    decision_data = json_module.loads(ai_response)

                    # 确保必要的字段存在
                    required_fields = ['action', 'symbol', 'confidence', 'reason']
                    for field in required_fields:
                        if field not in decision_data:
                            decision_data[field] = 'HOLD' if field == 'action' else symbol if field == 'symbol' else 0.5 if field == 'confidence' else 'AI分析完成'

                    # 添加额外字段
                    decision_data['executable'] = decision_data.get('executable', True)
                    decision_data['positionSize'] = decision_data.get('positionSize', decision_data.get('qty', 0))
                    decision_data['entry'] = decision_data.get('entry', 'N/A')
                    decision_data['stopLoss'] = decision_data.get('stopLoss', 'N/A')
                    decision_data['takeProfit'] = decision_data.get('takeProfit', 'N/A')
                    decision_data['riskLevel'] = decision_data.get('riskLevel', 'MEDIUM')
                    decision_data['timeFrame'] = decision_data.get('timeFrame', 'Intraday')

                    return jsonify({
                        'success': True,
                        'decision': decision_data,
                        'validation': {
                            'is_valid': True,
                            'message': 'AI 分析完成（带上下文）'
                        },
                        'risk_checks': {
                            'passed': ['ai_analysis_completed', 'context_analysis'],
                            'blocked': [],
                            'executable': decision_data.get('executable', False)
                        },
                        'history_id': int(time.time())
                    })

                except json_module.JSONDecodeError as json_error:
                    print(f'解析 AI 响应 JSON 失败: {json_error}')
                    return generate_context_based_analysis(symbol, context)

            else:
                print(f'DeepSeek API 调用失败: {response.status_code}')
                return generate_context_based_analysis(symbol, context)

        except Exception as api_error:
            print(f'DeepSeek API 调用异常: {api_error}')
            return generate_context_based_analysis(symbol, context)

    except Exception as e:
        print(f'AI Trade Analyze with Context 错误: {e}')
        return generate_context_based_analysis(symbol, {})

def build_context_analysis_prompt(symbol, context):
    """构建带上下文的AI分析提示"""

    account = context.get('accountSnapshot', {})
    positions = context.get('positions', [])
    open_orders = context.get('openOrders', [])
    order_history = context.get('orderHistory', [])
    portfolio = context.get('portfolioPerformance', {})

    prompt = f"""作为专业的量化交易AI助手，请基于以下完整的交易上下文分析股票{symbol}的交易机会。

## 交易账户上下文

### 账户概览
- 账户余额: ${account.get('cash', 0):,.2f}
- 账户净值: ${account.get('equity', 0):,.2f}
- 购买力: ${account.get('buyingPower', 0):,.2f}
- 投资组合价值: ${account.get('portfolioValue', 0):,.2f}
- 持仓数量: {account.get('positionsCount', 0)}
- 未平仓订单: {account.get('openOrdersCount', 0)}

### 当前持仓 ({len(positions)}个)
"""

    if positions:
        for i, pos in enumerate(positions[:5]):  # 只显示前5个
            prompt += f"- {pos.get('symbol', 'N/A')}: {pos.get('qty', 0)}股 @ ${pos.get('avgPrice', 0):.2f} (市值: ${pos.get('marketValue', 0):,.2f})\n"
        if len(positions) > 5:
            prompt += f"- ... 还有{len(positions)-5}个其他持仓\n"
    else:
        prompt += "- 无持仓\n"

    prompt += f"""
### 未平仓订单 ({len(open_orders)}个)
"""

    if open_orders:
        for i, order in enumerate(open_orders[:3]):  # 只显示前3个
            prompt += f"- {order.get('symbol', 'N/A')}: {order.get('side', 'N/A')} {order.get('qty', 0)}股 @ ${order.get('limitPrice', '市价')} ({order.get('status', 'N/A')})\n"
        if len(open_orders) > 3:
            prompt += f"- ... 还有{len(open_orders)-3}个其他订单\n"
    else:
        prompt += "- 无未平仓订单\n"

    prompt += f"""
### 近期订单历史 ({len(order_history)}条记录)
"""

    if order_history:
        for i, order in enumerate(order_history[:3]):  # 只显示前3个
            prompt += f"- {order.get('symbol', 'N/A')}: {order.get('side', 'N/A')} {order.get('qty', 0)}股 ({order.get('status', 'N/A')})\n"
        if len(order_history) > 3:
            prompt += f"- ... 还有{len(order_history)-3}条历史记录\n"
    else:
        prompt += "- 无订单历史\n"

    prompt += f"""
### 投资组合表现
- 当前时间范围: {portfolio.get('currentRange', '1D')}
- 投资组合变化: ${portfolio.get('change', {}).get('value', 0):,.2f} ({portfolio.get('change', {}).get('percent', 0):.2f}%)

### 交易环境
- 环境: {context.get('tradingEnvironment', 'paper')}
- AI状态: {context.get('aiStatus', {}).get('ai_status', 'idle')}

## 分析要求

请基于以上完整的交易上下文，为{symbol}提供专业的交易建议。

请以JSON格式返回，必须包含以下字段：
- action: "BUY", "SELL", 或 "HOLD" (基于当前持仓和账户状况)
- symbol: 股票代码
- confidence: 置信度 (0-1之间的小数)
- reason: 详细的分析理由 (至少100字)
- executable: true/false (基于风险检查)
- positionSize: 建议仓位大小 (股数)
- entry: 建议入场价格 (美元)
- stopLoss: 建议止损价格 (美元)
- takeProfit: 建议止盈价格 (美元)
- riskLevel: "LOW", "MEDIUM", 或 "HIGH"
- timeFrame: 建议持仓时间框架 (如: "Intraday", "Swing", "Position")

## 分析指导原则

1. 考虑当前持仓：如果已有{symbol}持仓，考虑是否加仓、减仓或持有
2. 考虑账户风险：基于账户余额和购买力确定合适的仓位大小
3. 考虑市场环境：当前是模拟交易环境
4. 提供具体的价格目标：基于技术分析或基本面分析
5. 风险管理：提供明确的止损和止盈价格

请确保建议是实际可行的，并且考虑了所有提供的上下文信息。
"""

    return prompt

def generate_context_based_analysis(symbol, context):
    """基于上下文生成简单的分析结果（当AI不可用时）"""

    account = context.get('accountSnapshot', {})
    positions = context.get('positions', [])
    portfolio = context.get('portfolioPerformance', {})

    # 检查是否已有该股票的持仓
    existing_position = None
    for pos in positions:
        if pos.get('symbol') == symbol:
            existing_position = pos
            break

    # 基于简单逻辑生成决策
    if existing_position:
        # 已有持仓，建议持有或卖出
        current_qty = existing_position.get('qty', 0)
        avg_price = existing_position.get('avgPrice', 0)
        market_value = existing_position.get('marketValue', 0)

        # 简单逻辑：如果持仓较大，建议部分卖出
        if market_value > account.get('portfolioValue', 100000) * 0.1:  # 持仓超过组合10%
            action = 'SELL'
            position_size = max(1, int(current_qty * 0.3))  # 卖出30%
            reason = f"已有{symbol}持仓{current_qty}股，市值${market_value:,.2f}，占投资组合比例较高，建议部分获利了结。"
        else:
            action = 'HOLD'
            position_size = 0
            reason = f"已有{symbol}持仓{current_qty}股，持仓比例适中，建议继续持有。"
    else:
        # 没有持仓，基于账户余额决定是否买入
        buying_power = account.get('buyingPower', 0)

        if buying_power > 1000:  # 有足够的购买力
            action = 'BUY'
            # 计算建议仓位：不超过购买力的5%
            max_position_value = buying_power * 0.05
            # 假设股价为150美元
            assumed_price = 150
            position_size = max(1, int(max_position_value / assumed_price))
            reason = f"账户有足够的购买力(${buying_power:,.2f})，建议建立{symbol}初始仓位。"
        else:
            action = 'HOLD'
            position_size = 0
            reason = f"账户购买力不足(${buying_power:,.2f})，建议观望。"

    # 生成价格建议（简单逻辑）
    if action == 'BUY':
        entry_price = 150  # 假设价格
        stop_loss = entry_price * 0.95  # 5%止损
        take_profit = entry_price * 1.08  # 8%止盈
    elif action == 'SELL':
        entry_price = 155  # 假设当前价格
        stop_loss = entry_price * 1.05  # 卖出时的止损（反向）
        take_profit = entry_price * 0.92  # 卖出时的止盈（反向）
    else:
        entry_price = 152
        stop_loss = 145
        take_profit = 160

    decision_data = {
        'action': action,
        'symbol': symbol,
        'confidence': 0.65 if action != 'HOLD' else 0.5,
        'reason': reason,
        'executable': action != 'HOLD',
        'positionSize': position_size,
        'entry': f"{entry_price:.2f}",
        'stopLoss': f"{stop_loss:.2f}",
        'takeProfit': f"{take_profit:.2f}",
        'riskLevel': 'MEDIUM',
        'timeFrame': 'Swing'
    }

    return jsonify({
        'success': True,
        'decision': decision_data,
        'validation': {
            'is_valid': True,
            'message': '基于上下文的简单分析完成'
        },
        'risk_checks': {
            'passed': ['context_analysis_completed'],
            'blocked': [],
            'executable': decision_data.get('executable', False)
        },
        'history_id': int(time.time())
    })

# ==================== 其他 AI Trading 接口 ====================

@app.route('/api/ai/trade/status', methods=['GET'])
def ai_trade_status():
    print('=== AI Trade Status 请求 ===')
    return jsonify({
        'success': True,
        'state': {
            'auto_mode': False,
            'paper_only': True,
            'human_confirm_required': True,
            'max_qty_per_order': 1,
            'max_notional_per_order': 1000,
            'max_orders_per_day': 10,
            'allowed_symbols': ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN'],
            'today_order_count': 0,
            'last_analysis_time': None,
            'last_execution_time': None,
            'ai_status': 'idle'
        },
        'history_count': 0
    })

@app.route('/api/ai/trade/history', methods=['GET'])
def ai_trade_history():
    print('=== AI Trade History 请求 ===')
    limit = request.args.get('limit', '50')
    return jsonify({
        'success': True,
        'history': [],
        'total_count': 0
    })

@app.route('/api/ai/trade/toggle', methods=['POST'])
def ai_trade_toggle():
    print('=== AI Trade Toggle 请求 ===')
    data = request.get_json()
    auto_mode = data.get('auto_mode', False)
    return jsonify({
        'success': True,
        'auto_mode': auto_mode,
        'paper_only': True,
        'human_confirm_required': True
    })

@app.route('/api/ai/trade/execute', methods=['POST'])
def ai_trade_execute():
    print('=== AI Trade Execute 请求 ===')
    data = request.get_json()
    history_id = data.get('history_id', 0)
    confirmed = data.get('confirmed', False)

    return jsonify({
        'success': True,
        'order': {
            'id': f'order-{int(time.time())}',
            'symbol': 'AAPL',
            'qty': 1,
            'side': 'buy',
            'type': 'market',
            'status': 'accepted'
        },
        'execution_time': time.time(),
        'message': '交易执行成功（模拟）'
    })

@app.route('/api/ai/trading/environment', methods=['GET', 'POST'])
def ai_trading_environment():
    print('=== AI Trading Environment 请求 ===')

    if request.method == 'GET':
        return jsonify({
            'success': True,
            'environment': {
                'environment': alpaca_config_state.get('environment', 'paper')
            }
        })
    else:
        # POST 方法
        data = request.get_json()
        environment = data.get('environment', 'paper')

        alpaca_config_state['environment'] = environment

        return jsonify({
            'success': True,
            'environment': {
                'environment': environment
            }
        })

# ==================== 基础接口 ====================

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        'status': 'online',
        'timestamp': int(time.time()),
        'version': '1.0.0-simple-with-ai'
    })

@app.route('/api/market/stocks', methods=['GET'])
@app.route('/market/stocks', methods=['GET'])
@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """股票列表接口 - 优化版本"""
    start_time = time.time()

    try:
        # 获取参数
        symbols_param = request.args.get('symbols', '')

        # 确定股票列表
        if symbols_param:
            symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
        else:
            symbols = DEFAULT_SYMBOLS

        # 限制最大股票数量，避免过多API调用
        if len(symbols) > 20:
            symbols = symbols[:20]

        # 并行获取所有股票数据
        stocks = []
        success_count = 0

        # 使用线程池并行处理
        max_workers = min(5, len(symbols))  # 限制并发数，避免触发API限制
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # 提交所有任务
            future_to_symbol = {executor.submit(fetch_stock_data_parallel, symbol): symbol for symbol in symbols}

            # 收集结果
            for future in as_completed(future_to_symbol):
                symbol = future_to_symbol[future]
                try:
                    stock_data, success = future.result()
                    stocks.append(stock_data)
                    if success:
                        success_count += 1
                except Exception as e:
                    # 处理异常情况
                    stocks.append({
                        "symbol": symbol.upper(),
                        "name": f"{symbol.upper()} Inc.",
                        "price": None,
                        "change": None,
                        "changePercent": None,
                        "dayHigh": None,
                        "dayLow": None,
                        "open": None,
                        "previousClose": None,
                        "marketCap": None,
                        "currency": "USD",
                        "exchange": "NASDAQ",
                        "industry": "Technology",
                        "sector": "Technology",
                        "dataSource": "Finnhub (异常)",
                        "timestamp": int(time.time()),
                        "error": str(e)
                    })

        # 按symbol排序，保持一致性
        stocks.sort(key=lambda x: x['symbol'])

        elapsed = time.time() - start_time

        return jsonify({
            "stocks": stocks,
            "count": len(stocks),
            "dataSource": "Finnhub",
            "successCount": success_count,
            "failedCount": len(symbols) - success_count,
            "responseTime": round(elapsed, 3),
            "cacheInfo": {
                "enabled": True,
                "ttl": CACHE_TTL,
                "cacheHits": "统计在缓存类中",
                "timestamp": int(time.time())
            }
        }), 200

    except Exception as e:
        elapsed = time.time() - start_time
        return jsonify({
            "stocks": [],
            "count": 0,
            "dataSource": "Finnhub (错误)",
            "error": str(e),
            "responseTime": round(elapsed, 3),
            "timestamp": int(time.time())
        }), 500

@app.route('/market/stock/<symbol>', methods=['GET'])
@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_detail(symbol):
    """股票详情接口 - 使用Finnhub API"""
    start_time = time.time()

    try:
        symbol_upper = symbol.upper()

        # 并行获取quote和profile数据
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_quote = executor.submit(fetch_finnhub_quote, symbol_upper)
            future_profile = executor.submit(fetch_finnhub_profile, symbol_upper)

            quote_data, quote_error = future_quote.result()
            profile_data, profile_error = future_profile.result()

        # 股票名称映射
        STOCK_NAMES = {
            'AAPL': 'Apple Inc.',
            'MSFT': 'Microsoft Corporation',
            'GOOGL': 'Alphabet Inc.',
            'AMZN': 'Amazon.com Inc.',
            'TSLA': 'Tesla Inc.',
            'NVDA': 'NVIDIA Corporation',
            'META': 'Meta Platforms Inc.',
            'JPM': 'JPMorgan Chase & Co.',
            'JNJ': 'Johnson & Johnson',
            'V': 'Visa Inc.',
            'AMD': 'Advanced Micro Devices Inc.',
            'NFLX': 'Netflix Inc.',
            'INTC': 'Intel Corporation',
            'PYPL': 'PayPal Holdings Inc.',
            'ADBE': 'Adobe Inc.',
            'CSCO': 'Cisco Systems Inc.',
            'PEP': 'PepsiCo Inc.',
            'COST': 'Costco Wholesale Corporation',
            'DIS': 'The Walt Disney Company',
            'WMT': 'Walmart Inc.'
        }

        # 构建响应数据
        stock_info = {
            "symbol": symbol_upper,
            "name": STOCK_NAMES.get(symbol_upper, f"{symbol_upper} Inc."),
            "dataSource": "Finnhub",
            "timestamp": int(time.time()),
            "responseTime": round(time.time() - start_time, 3),
            "success": True
        }

        # 处理quote数据
        if quote_data:
            stock_info.update({
                "price": quote_data.get('c'),
                "change": quote_data.get('d'),
                "changePercent": quote_data.get('dp'),
                "dayHigh": quote_data.get('h'),
                "dayLow": quote_data.get('l'),
                "open": quote_data.get('o'),
                "previousClose": quote_data.get('pc')
            })

        # 处理profile数据
        if profile_data:
            stock_info.update({
                "marketCap": profile_data.get('marketCapitalization'),
                "currency": profile_data.get('currency', 'USD'),
                "exchange": profile_data.get('exchange', 'NASDAQ'),
                "industry": profile_data.get('finnhubIndustry', 'Technology'),
                "sector": profile_data.get('finnhubSector', 'Technology')
            })

            # 如果有profile中的名称，使用它
            if profile_data.get('name'):
                stock_info["name"] = profile_data.get('name')

        # 检查是否有有效数据
        if stock_info.get('price') is None or stock_info.get('price') == 0:
            stock_info["success"] = False
            stock_info["error"] = f"无法获取股票数据: quote_error={quote_error}, profile_error={profile_error}"

        return jsonify(stock_info), 200

    except Exception as e:
        elapsed = time.time() - start_time
        return jsonify({
            "symbol": symbol.upper(),
            "name": f"{symbol.upper()} Inc.",
            "price": None,
            "change": None,
            "changePercent": None,
            "dayHigh": None,
            "dayLow": None,
            "open": None,
            "previousClose": None,
            "marketCap": None,
            "currency": "USD",
            "exchange": "NASDAQ",
            "industry": "Technology",
            "sector": "Technology",
            "dataSource": "Finnhub (错误)",
            "timestamp": int(time.time()),
            "responseTime": round(elapsed, 3),
            "success": False,
            "error": str(e)
        }), 500

# ==================== 历史数据路由（新增） ====================
@app.route('/market/history/<symbol>', methods=['GET'])
@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """图表历史数据接口"""
    print(f"[历史数据接口] 被调用: symbol={symbol}")

    try:
        # 获取参数
        timeframe = request.args.get('timeframe', '1M')
        interval = request.args.get('interval', '1day')
        range_param = request.args.get('range', '1month')

        print(f"[历史数据接口] 参数: timeframe={timeframe}, interval={interval}, range={range_param}")

        # 映射区间
        interval_map = {
            '1min': '1min',
            '5min': '5min',
            '15min': '15min',
            '30min': '30min',
            '45min': '45min',
            '1h': '1h',
            '2h': '2h',
            '4h': '4h',
            '1day': '1day',
            '1week': '1week',
            '1month': '1month'
        }

        range_map = {
            '1D': '1day',
            '1W': '1week',
            '1M': '1month',
            '3M': '3month',
            '1Y': '1year',
            '5Y': '5year'
        }

        mapped_interval = interval_map.get(interval, '1day')
        mapped_range = range_map.get(range_param, '1month')

        # 首先尝试使用Twelve Data API获取历史数据
        historical_data, success, data_source_note = get_twelvedata_history(
            symbol, mapped_interval, mapped_range
        )

        # 如果Twelve Data失败，尝试使用Finnhub作为备选
        if not success or not historical_data:
            print(f"[历史数据接口] Twelve Data获取失败，尝试Finnhub备选方案: {data_source_note}")
            historical_data, success, data_source_note = get_finnhub_history(
                symbol, mapped_interval, range_param  # 注意：这里使用原始range_param
            )

        if success and historical_data:
            print(f"[历史数据接口] 成功获取 {len(historical_data)} 条数据，数据源: {data_source_note}")
            return jsonify({
                "symbol": symbol.upper(),
                "data": historical_data,
                "count": len(historical_data),
                "timeframe": timeframe,
                "interval": interval,
                "range": range_param,
                "dataSource": data_source_note,
                "success": True,
                "timestamp": int(time.time())
            }), 200
        else:
            print(f"[历史数据接口] 获取数据失败: {data_source_note}")
            return jsonify({
                "symbol": symbol.upper(),
                "data": [],
                "count": 0,
                "timeframe": timeframe,
                "interval": interval,
                "range": range_param,
                "dataSource": data_source_note,
                "success": False,
                "error": data_source_note,
                "timestamp": int(time.time())
            }), 200  # 仍然返回200，但success=False

    except Exception as e:
        print(f"[历史数据接口] 异常: {str(e)}")
        return jsonify({
            "symbol": symbol.upper(),
            "data": [],
            "count": 0,
            "timeframe": request.args.get('timeframe', '1M'),
            "interval": request.args.get('interval', '1day'),
            "range": request.args.get('range', '1month'),
            "dataSource": "Twelve Data (异常)",
            "success": False,
            "error": str(e),
            "timestamp": int(time.time())
        }), 500

@app.route('/backtest/run', methods=['POST'])
@app.route('/api/backtest/run', methods=['POST'])
def run_backtest():
    """运行回测 - 优化版，使用真实数据"""
    total_start = time.time()

    try:
        data = request.get_json()
        print(f"[Backtest] 收到回测请求: {data}")

        # 提取配置
        user_input = data.get('symbol', 'AAPL')
        strategy = data.get('strategy', 'moving_average')
        start_date = data.get('startDate', '2024-01-01')
        end_date = data.get('endDate', '2024-12-31')
        initial_capital = data.get('initialCapital', 10000)
        data_mode = data.get('dataMode', 'real')
        parameters = data.get('parameters', {})

        # 生成backtest ID
        import uuid
        backtest_id = str(uuid.uuid4())[:8]

        print(f"[Backtest] 开始处理，ID: {backtest_id}")

        # 阶段1: symbol验证
        stage1_start = time.time()
        print(f"[Backtest] 阶段1: 验证股票输入")

        # 简单的symbol验证
        symbol = user_input.upper().strip()
        if not symbol or len(symbol) > 10:
            validation_message = f"无效的股票代码: '{user_input}'"
            print(f"[Backtest] 股票输入无效: {validation_message}")
            return jsonify({
                "success": False,
                "error": validation_message,
                "backtestId": backtest_id,
                "results": None,
                "chartData": None,
                "trades": None,
                "parameters": {
                    "symbol": "",
                    "symbols": [],
                    "strategy": strategy,
                    "startDate": start_date,
                    "endDate": end_date,
                    "period": f"{start_date} to {end_date}",
                    "initialCapital": initial_capital,
                    "dataMode": "real",
                    "dataModeDisplay": "Real Data",
                    "dataSource": "Invalid input"
                }
            }), 200

        stage1_time = time.time() - stage1_start
        print(f"[Backtest] 阶段1完成，耗时: {stage1_time:.2f}秒")

        # 只支持真实数据模式
        print(f"[Backtest] 使用真实数据模式")

        # 阶段2: 获取历史数据
        stage2_start = time.time()
        print(f"[Backtest] 阶段2: 获取历史数据")

        # 只使用Twelve Data获取历史数据
        historical_data = None
        data_source = None
        data_mode_display = "Real Data"
        data_source_note = ""

        # 使用日线数据
        interval = "1day"

        # 1. 使用Twelve Data日期范围API（精确匹配回测日期范围）
        print(f"[Backtest] 使用Twelve Data获取历史数据: {symbol}, start={start_date}, end={end_date}")

        try:
            # 直接使用start_date和end_date作为参数
            historical_data, success, data_source_note = get_twelvedata_history(
                symbol, interval, f"{start_date} to {end_date}"
            )

            if success and historical_data:
                data_source = data_source_note
                print(f"[Backtest] 获取历史数据成功 ({data_source}): {len(historical_data)} 个数据点")
            else:
                print(f"[Backtest] Twelve Data获取失败: {data_source_note}")
                return jsonify({
                    "success": False,
                    "error": f"无法从Twelve Data获取历史数据: {data_source_note}",
                    "backtestId": backtest_id,
                    "results": None,
                    "chartData": None,
                    "trades": None,
                    "parameters": {
                        "symbol": symbol,
                        "symbols": [symbol],
                        "strategy": strategy,
                        "startDate": start_date,
                        "endDate": end_date,
                        "period": f"{start_date} to {end_date}",
                        "initialCapital": initial_capital,
                        "dataMode": "real",
                        "dataModeDisplay": "Real Data",
                        "dataSource": data_source_note
                    }
                }), 200

        except Exception as e:
            print(f"[Backtest] 获取历史数据异常: {str(e)}")
            return jsonify({
                "success": False,
                "error": f"获取历史数据异常: {str(e)}",
                "backtestId": backtest_id,
                "results": None,
                "chartData": None,
                "trades": None,
                "parameters": {
                    "symbol": symbol,
                    "symbols": [symbol],
                    "strategy": strategy,
                    "startDate": start_date,
                    "endDate": end_date,
                    "period": f"{start_date} to {end_date}",
                    "initialCapital": initial_capital,
                    "dataMode": "real",
                    "dataModeDisplay": "Real Data",
                    "dataSource": "Twelve Data (异常)"
                }
            }), 200

        stage2_time = time.time() - stage2_start
        print(f"[Backtest] 阶段2完成，耗时: {stage2_time:.2f}秒")

        # 阶段3: 执行回测逻辑
        stage3_start = time.time()
        print(f"[Backtest] 阶段3: 执行回测逻辑 - 策略: {strategy}, 参数: {parameters}")

        # 策略分发函数
        def run_moving_average_strategy(data, params, initial_capital, symbol):
            """移动平均线交叉策略"""
            short_period = params.get('shortMaPeriod', 20)
            long_period = params.get('longMaPeriod', 50)

            trades = []
            equity_curve = []
            chart_data = []  # 完整的图表数据
            position = 0
            cash = initial_capital
            equity = initial_capital

            # 计算移动平均线
            prices = [point['close'] for point in data]
            sma_short = []
            sma_long = []

            for i in range(len(prices)):
                if i >= short_period:
                    sma_short.append(sum(prices[i-short_period:i]) / short_period)
                else:
                    sma_short.append(prices[i])

                if i >= long_period:
                    sma_long.append(sum(prices[i-long_period:i]) / long_period)
                else:
                    sma_long.append(prices[i])

            # 执行交易策略
            for i, data_point in enumerate(data):
                date = data_point['timestamp']
                price = data_point['close']

                # 交易信号
                if i >= max(short_period, long_period):
                    # 短期均线上穿长期均线 - 买入信号
                    if sma_short[i] > sma_long[i] and (i == 0 or sma_short[i-1] <= sma_long[i-1]):
                        if cash > 0 and position == 0:
                            shares_to_buy = cash // price
                            if shares_to_buy > 0:
                                cost = shares_to_buy * price
                                cash -= cost
                                position = shares_to_buy
                                trades.append({
                                    'entryDate': date,
                                    'exitDate': None,
                                    'entryPrice': price,
                                    'exitPrice': None,
                                    'pnl': 0,
                                    'returnPct': 0,
                                    'holdingPeriod': 0,
                                    'position': 1,
                                    'action': 'BUY',
                                    'quantity': shares_to_buy,
                                    'symbol': symbol
                                })
                                # 更新chartData中的signal字段为1（买入）
                                # 注意：chart_data的长度应该等于i+1，因为我们在循环中构建
                                if len(chart_data) > 0:
                                    chart_data[-1]['signal'] = 1

                    # 短期均线下穿长期均线 - 卖出信号
                    elif sma_short[i] < sma_long[i] and (i == 0 or sma_short[i-1] >= sma_long[i-1]):
                        if position > 0:
                            value = position * price
                            cash += value
                            # 更新最近一次交易的退出信息
                            for trade in reversed(trades):
                                if trade.get('exitDate') is None and trade.get('action') == 'BUY':
                                    entry_price = trade['entryPrice']
                                    pnl = (price - entry_price) * trade['quantity']
                                    return_pct = ((price - entry_price) / entry_price) * 100 if entry_price > 0 else 0

                                    trade['exitDate'] = date
                                    trade['exitPrice'] = price
                                    trade['pnl'] = round(pnl, 2)
                                    trade['returnPct'] = round(return_pct, 2)
                                    trade['holdingPeriod'] = i - next((idx for idx, p in enumerate(data) if p['timestamp'] == trade['entryDate']), i)
                                    break
                            position = 0
                            # 更新chartData中的signal字段为-1（卖出）
                            if len(chart_data) > 0:
                                chart_data[-1]['signal'] = -1

                # 计算当前权益
                equity = cash + (position * price)
                equity_curve.append({
                    'date': date,
                    'equity': equity,
                    'price': price
                })

                # 构建完整的图表数据
                chart_data.append({
                    'date': date,
                    'open': data_point['open'],
                    'high': data_point['high'],
                    'low': data_point['low'],
                    'close': data_point['close'],
                    'volume': data_point['volume'],
                    'price': price,  # 当前价格（与close相同）
                    'equity': equity,  # 当前权益
                    'signal': 0  # 默认无信号，后面会根据交易更新
                })

            return trades, equity_curve, chart_data

        def run_rsi_strategy(data, params, initial_capital, symbol):
            """RSI策略"""
            period = params.get('rsiPeriod', 14)
            oversold = params.get('rsiOversold', 30)
            overbought = params.get('rsiOverbought', 70)

            trades = []
            equity_curve = []
            chart_data = []  # 完整的图表数据
            position = 0
            cash = initial_capital
            equity = initial_capital

            # 计算RSI
            prices = [point['close'] for point in data]
            rsi_values = []

            for i in range(len(prices)):
                if i < period:
                    rsi_values.append(50)  # 默认值
                else:
                    gains = []
                    losses = []
                    for j in range(i-period, i):
                        change = prices[j+1] - prices[j] if j+1 < len(prices) else 0
                        if change > 0:
                            gains.append(change)
                        else:
                            losses.append(abs(change))

                    avg_gain = sum(gains) / period if gains else 0
                    avg_loss = sum(losses) / period if losses else 0

                    if avg_loss == 0:
                        rsi = 100
                    else:
                        rs = avg_gain / avg_loss
                        rsi = 100 - (100 / (1 + rs))

                    rsi_values.append(rsi)

            # 执行交易策略
            for i, data_point in enumerate(data):
                date = data_point['timestamp']
                price = data_point['close']

                # 交易信号
                if i >= period:
                    rsi = rsi_values[i]

                    # RSI超卖 - 买入信号
                    if rsi < oversold and position == 0:
                        if cash > 0:
                            shares_to_buy = cash // price
                            if shares_to_buy > 0:
                                cost = shares_to_buy * price
                                cash -= cost
                                position = shares_to_buy
                                trades.append({
                                    'entryDate': date,
                                    'exitDate': None,
                                    'entryPrice': price,
                                    'exitPrice': None,
                                    'pnl': 0,
                                    'returnPct': 0,
                                    'holdingPeriod': 0,
                                    'position': 1,
                                    'action': 'BUY',
                                    'quantity': shares_to_buy,
                                    'symbol': symbol
                                })

                    # RSI超买 - 卖出信号
                    elif rsi > overbought and position > 0:
                        value = position * price
                        cash += value
                        # 更新最近一次交易的退出信息
                        for trade in reversed(trades):
                            if trade.get('exitDate') is None and trade.get('action') == 'BUY':
                                entry_price = trade['entryPrice']
                                pnl = (price - entry_price) * trade['quantity']
                                return_pct = ((price - entry_price) / entry_price) * 100 if entry_price > 0 else 0

                                trade['exitDate'] = date
                                trade['exitPrice'] = price
                                trade['pnl'] = round(pnl, 2)
                                trade['returnPct'] = round(return_pct, 2)
                                trade['holdingPeriod'] = i - next((idx for idx, p in enumerate(data) if p['timestamp'] == trade['entryDate']), i)
                                break
                        position = 0

                # 计算当前权益
                equity = cash + (position * price)
                equity_curve.append({
                    'date': date,
                    'equity': equity,
                    'price': price
                })

                # 构建完整的图表数据
                chart_data.append({
                    'date': date,
                    'open': data_point['open'],
                    'high': data_point['high'],
                    'low': data_point['low'],
                    'close': data_point['close'],
                    'volume': data_point['volume'],
                    'price': price,
                    'equity': equity
                })

            return trades, equity_curve, chart_data

        def run_bollinger_strategy(data, params, initial_capital, symbol):
            """布林带策略"""
            period = params.get('bollingerPeriod', 20)
            std_dev = params.get('bollingerStdDev', 2)

            trades = []
            equity_curve = []
            position = 0
            cash = initial_capital
            equity = initial_capital

            # 计算布林带
            prices = [point['close'] for point in data]
            sma_values = []
            upper_band = []
            lower_band = []

            for i in range(len(prices)):
                if i >= period:
                    # 计算简单移动平均
                    sma = sum(prices[i-period:i]) / period
                    sma_values.append(sma)

                    # 计算标准差
                    variance = sum((p - sma) ** 2 for p in prices[i-period:i]) / period
                    std = variance ** 0.5

                    upper_band.append(sma + std_dev * std)
                    lower_band.append(sma - std_dev * std)
                else:
                    sma_values.append(prices[i])
                    upper_band.append(prices[i])
                    lower_band.append(prices[i])

            # 执行交易策略
            for i, data_point in enumerate(data):
                date = data_point['timestamp']
                price = data_point['close']

                # 交易信号
                if i >= period:
                    # 价格跌破下轨 - 买入信号（超卖）
                    if price < lower_band[i] and position == 0:
                        if cash > 0:
                            shares_to_buy = cash // price
                            if shares_to_buy > 0:
                                cost = shares_to_buy * price
                                cash -= cost
                                position = shares_to_buy
                                trades.append({
                                    'entryDate': date,
                                    'exitDate': None,
                                    'entryPrice': price,
                                    'exitPrice': None,
                                    'pnl': 0,
                                    'returnPct': 0,
                                    'holdingPeriod': 0,
                                    'position': 1,
                                    'action': 'BUY',
                                    'quantity': shares_to_buy,
                                    'symbol': symbol
                                })

                    # 价格突破上轨 - 卖出信号（超买）
                    elif price > upper_band[i] and position > 0:
                        value = position * price
                        cash += value
                        # 更新最近一次交易的退出信息
                        for trade in reversed(trades):
                            if trade.get('exitDate') is None and trade.get('action') == 'BUY':
                                entry_price = trade['entryPrice']
                                pnl = (price - entry_price) * trade['quantity']
                                return_pct = ((price - entry_price) / entry_price) * 100 if entry_price > 0 else 0

                                trade['exitDate'] = date
                                trade['exitPrice'] = price
                                trade['pnl'] = round(pnl, 2)
                                trade['returnPct'] = round(return_pct, 2)
                                trade['holdingPeriod'] = i - next((idx for idx, p in enumerate(data) if p['timestamp'] == trade['entryDate']), i)
                                break
                        position = 0

                # 计算当前权益
                equity = cash + (position * price)
                equity_curve.append({
                    'date': date,
                    'equity': equity,
                    'price': price
                })

            return trades, equity_curve

        def run_momentum_strategy(data, params, initial_capital, symbol):
            """动量策略"""
            period = params.get('momentumPeriod', 10)

            trades = []
            equity_curve = []
            position = 0
            cash = initial_capital
            equity = initial_capital

            # 计算动量
            prices = [point['close'] for point in data]
            momentum_values = []

            for i in range(len(prices)):
                if i >= period:
                    momentum = prices[i] - prices[i-period]
                    momentum_values.append(momentum)
                else:
                    momentum_values.append(0)

            # 执行交易策略
            for i, data_point in enumerate(data):
                date = data_point['timestamp']
                price = data_point['close']

                # 交易信号
                if i >= period:
                    # 正动量 - 买入信号
                    if momentum_values[i] > 0 and position == 0:
                        if cash > 0:
                            shares_to_buy = cash // price
                            if shares_to_buy > 0:
                                cost = shares_to_buy * price
                                cash -= cost
                                position = shares_to_buy
                                trades.append({
                                    'entryDate': date,
                                    'exitDate': None,
                                    'entryPrice': price,
                                    'exitPrice': None,
                                    'pnl': 0,
                                    'returnPct': 0,
                                    'holdingPeriod': 0,
                                    'position': 1,
                                    'action': 'BUY',
                                    'quantity': shares_to_buy,
                                    'symbol': symbol
                                })

                    # 负动量 - 卖出信号
                    elif momentum_values[i] < 0 and position > 0:
                        value = position * price
                        cash += value
                        # 更新最近一次交易的退出信息
                        for trade in reversed(trades):
                            if trade.get('exitDate') is None and trade.get('action') == 'BUY':
                                entry_price = trade['entryPrice']
                                pnl = (price - entry_price) * trade['quantity']
                                return_pct = ((price - entry_price) / entry_price) * 100 if entry_price > 0 else 0

                                trade['exitDate'] = date
                                trade['exitPrice'] = price
                                trade['pnl'] = round(pnl, 2)
                                trade['returnPct'] = round(return_pct, 2)
                                trade['holdingPeriod'] = i - next((idx for idx, p in enumerate(data) if p['timestamp'] == trade['entryDate']), i)
                                break
                        position = 0

                # 计算当前权益
                equity = cash + (position * price)
                equity_curve.append({
                    'date': date,
                    'equity': equity,
                    'price': price
                })

            return trades, equity_curve

        def run_macd_strategy(data, params, initial_capital, symbol):
            """MACD策略"""
            fast_period = params.get('macdFast', 12)
            slow_period = params.get('macdSlow', 26)
            signal_period = params.get('macdSignal', 9)

            trades = []
            equity_curve = []
            position = 0
            cash = initial_capital
            equity = initial_capital

            # 计算MACD
            prices = [point['close'] for point in data]
            ema_fast = []
            ema_slow = []
            macd_line = []
            signal_line = []
            histogram = []

            for i in range(len(prices)):
                # 计算EMA
                if i == 0:
                    ema_fast.append(prices[i])
                    ema_slow.append(prices[i])
                else:
                    fast_alpha = 2 / (fast_period + 1)
                    slow_alpha = 2 / (slow_period + 1)
                    ema_fast.append(prices[i] * fast_alpha + ema_fast[i-1] * (1 - fast_alpha))
                    ema_slow.append(prices[i] * slow_alpha + ema_slow[i-1] * (1 - slow_alpha))

                # 计算MACD线
                macd = ema_fast[i] - ema_slow[i]
                macd_line.append(macd)

                # 计算信号线
                if i == 0:
                    signal_line.append(macd)
                elif i < signal_period:
                    signal_line.append(macd)
                else:
                    signal_alpha = 2 / (signal_period + 1)
                    signal_line.append(macd * signal_alpha + signal_line[i-1] * (1 - signal_alpha))

                # 计算柱状图
                histogram.append(macd_line[i] - signal_line[i])

            # 执行交易策略
            for i, data_point in enumerate(data):
                date = data_point['timestamp']
                price = data_point['close']

                # 交易信号
                if i >= max(fast_period, slow_period, signal_period):
                    # MACD线上穿信号线 - 买入信号
                    if histogram[i] > 0 and (i == 0 or histogram[i-1] <= 0):
                        if cash > 0 and position == 0:
                            shares_to_buy = cash // price
                            if shares_to_buy > 0:
                                cost = shares_to_buy * price
                                cash -= cost
                                position = shares_to_buy
                                trades.append({
                                    'entryDate': date,
                                    'exitDate': None,
                                    'entryPrice': price,
                                    'exitPrice': None,
                                    'pnl': 0,
                                    'returnPct': 0,
                                    'holdingPeriod': 0,
                                    'position': 1,
                                    'action': 'BUY',
                                    'quantity': shares_to_buy,
                                    'symbol': symbol
                                })

                    # MACD线下穿信号线 - 卖出信号
                    elif histogram[i] < 0 and (i == 0 or histogram[i-1] >= 0):
                        if position > 0:
                            value = position * price
                            cash += value
                            # 更新最近一次交易的退出信息
                            for trade in reversed(trades):
                                if trade.get('exitDate') is None and trade.get('action') == 'BUY':
                                    entry_price = trade['entryPrice']
                                    pnl = (price - entry_price) * trade['quantity']
                                    return_pct = ((price - entry_price) / entry_price) * 100 if entry_price > 0 else 0

                                    trade['exitDate'] = date
                                    trade['exitPrice'] = price
                                    trade['pnl'] = round(pnl, 2)
                                    trade['returnPct'] = round(return_pct, 2)
                                    trade['holdingPeriod'] = i - next((idx for idx, p in enumerate(data) if p['timestamp'] == trade['entryDate']), i)
                                    break
                            position = 0

                # 计算当前权益
                equity = cash + (position * price)
                equity_curve.append({
                    'date': date,
                    'equity': equity,
                    'price': price
                })

            return trades, equity_curve

        # 简化回测逻辑 - 基于历史数据生成模拟结果
        if historical_data and len(historical_data) > 0:
            # 计算基本统计
            first_close = historical_data[0]['close']
            last_close = historical_data[-1]['close']
            price_change = last_close - first_close
            price_change_pct = (price_change / first_close) * 100 if first_close > 0 else 0

            # 根据策略类型执行不同的算法
            trades = []
            equity_curve = []

            # 支持的策略映射
            supported_strategies = {
                'moving_average': run_moving_average_strategy,
                'rsi': run_rsi_strategy,
                'macd': run_macd_strategy,
                'bollinger': run_bollinger_strategy,
                'momentum': run_momentum_strategy
            }

            strategy_fn = supported_strategies.get(strategy)
            if strategy_fn is None:
                print(f"[Backtest] 不支持的策略: '{strategy}'")
                return jsonify({
                    "success": False,
                    "error": f"不支持的策略: {strategy}",
                    "supportedStrategies": list(supported_strategies.keys()),
                    "backtestId": backtest_id,
                    "results": None,
                    "chartData": None,
                    "trades": None,
                    "parameters": {
                        "symbol": symbol,
                        "symbols": [symbol],
                        "strategy": strategy,
                        "startDate": start_date,
                        "endDate": end_date,
                        "period": f"{start_date} to {end_date}",
                        "initialCapital": initial_capital,
                        "dataMode": "real",
                        "dataModeDisplay": "Real Data",
                        "dataSource": "Unsupported strategy",
                        "parameters": parameters
                    }
                }), 400

            print(f"[Backtest] 执行{strategy}策略，参数: {parameters}")
            # 调用策略函数，获取trades和equity_curve
            strategy_result = strategy_fn(historical_data, parameters, initial_capital, symbol)

            # 处理返回值（兼容旧版本和新版本）
            if len(strategy_result) == 3:
                trades, equity_curve, chart_data = strategy_result
            else:
                trades, equity_curve = strategy_result
                # 如果没有chart_data，使用historical_data构建基本的chart_data
                chart_data = []
                for i, data_point in enumerate(historical_data):
                    # 计算权益（简化版本）
                    equity = initial_capital
                    if equity_curve and i < len(equity_curve):
                        equity = equity_curve[i]['equity']

                    chart_data.append({
                        'date': data_point['timestamp'],
                        'open': data_point['open'],
                        'high': data_point['high'],
                        'low': data_point['low'],
                        'close': data_point['close'],
                        'volume': data_point['volume'],
                        'price': data_point['close'],
                        'equity': equity
                    })

            # 计算最终结果
            final_equity = equity_curve[-1]['equity'] if equity_curve else initial_capital
            total_return = ((final_equity - initial_capital) / initial_capital) * 100
            profit_loss = final_equity - initial_capital

            # 计算最大回撤
            max_drawdown = 0
            peak = initial_capital
            for point in equity_curve:
                equity_val = point['equity']
                if equity_val > peak:
                    peak = equity_val
                drawdown = (peak - equity_val) / peak * 100
                if drawdown > max_drawdown:
                    max_drawdown = drawdown

            # ========== 统一的交易统计口径 ==========
            # 1. 定义：已平仓交易 (closed trades) - 有exitDate的交易
            completed_trades = [t for t in trades if t.get('exitDate') is not None]

            # 2. 定义：未平仓交易 (open trades) - 没有exitDate的交易
            open_trades = [t for t in trades if t.get('exitDate') is None]

            # 3. 强制平仓：如果回测结束时还有未平仓头寸，强制平仓
            forced_liquidation_pnl = 0
            if open_trades and equity_curve:
                last_price = equity_curve[-1]['price']
                last_date = equity_curve[-1]['date']
                for trade in open_trades:
                    entry_price = trade.get('entryPrice', 0)
                    quantity = trade.get('quantity', 0)
                    pnl = (last_price - entry_price) * quantity

                    # 更新交易记录
                    trade['exitDate'] = last_date
                    trade['exitPrice'] = last_price
                    trade['pnl'] = round(pnl, 2)
                    trade['returnPct'] = round(((last_price - entry_price) / entry_price * 100), 2) if entry_price > 0 else 0

                    forced_liquidation_pnl += pnl
                    completed_trades.append(trade)

                # 为强制平仓添加信号（-2表示强制平仓）
                # 找到chartData中对应的最后一天
                if chart_data:
                    for i, data_point in enumerate(chart_data):
                        if data_point.get('date') == last_date:
                            chart_data[i]['signal'] = -2  # -2表示强制平仓
                            break

            # 4. 基于已平仓交易计算所有指标
            # 分离盈利、亏损、盈亏平衡交易（使用严格定义）
            winning_trades = [t for t in completed_trades if t.get('pnl', 0) > 0.01]  # 大于1分钱才算盈利
            losing_trades = [t for t in completed_trades if t.get('pnl', 0) < -0.01]  # 小于-1分钱才算亏损
            breakeven_trades = [t for t in completed_trades if abs(t.get('pnl', 0)) <= 0.01]  # 绝对值<=1分钱算持平

            # 5. 计算gross profit/loss (只考虑已实现盈亏)
            gross_profit = sum(t.get('pnl', 0) for t in winning_trades)
            gross_loss = abs(sum(t.get('pnl', 0) for t in losing_trades))
            net_profit_from_trades = gross_profit - gross_loss

            # 6. 验证一致性：net_profit_from_trades 应该等于 profit_loss (final_equity - initial_capital)
            # 因为我们已经强制平仓了所有未平仓头寸
            consistency_check = abs(net_profit_from_trades - profit_loss) < 0.01

            if not consistency_check:
                print(f"[Backtest] 警告: 交易PNL总和({net_profit_from_trades:.2f})与最终盈亏({profit_loss:.2f})不一致")
                # 使用交易PNL总和作为净利润（更准确）
                profit_loss = net_profit_from_trades
                final_equity = initial_capital + profit_loss
                total_return = (profit_loss / initial_capital) * 100

            # 7. 计算其他指标
            total_closed_trades = len(completed_trades)
            total_winning_trades = len(winning_trades)
            total_losing_trades = len(losing_trades)
            total_breakeven_trades = len(breakeven_trades)

            # win rate基于盈利交易占所有非持平交易的比例
            non_breakeven_trades = total_winning_trades + total_losing_trades
            win_rate = (total_winning_trades / non_breakeven_trades * 100) if non_breakeven_trades > 0 else 0

            avg_win = sum(t.get('pnl', 0) for t in winning_trades) / len(winning_trades) if winning_trades else 0
            avg_loss = sum(t.get('pnl', 0) for t in losing_trades) / len(losing_trades) if losing_trades else 0

            # 8. 正确计算profit factor
            profit_factor = gross_profit / gross_loss if gross_loss > 0 else None

            # 9. 计算expectancy
            expectancy = ((win_rate / 100) * avg_win) - ((1 - win_rate / 100) * abs(avg_loss)) if total_closed_trades > 0 else 0

            print(f"[Backtest] 交易统计:")
            print(f"  总交易数: {len(trades)}")
            print(f"  已平仓交易: {total_closed_trades}")
            print(f"  盈利交易: {len(winning_trades)}")
            print(f"  亏损交易: {len(losing_trades)}")
            print(f"  盈亏平衡交易: {len(breakeven_trades)}")
            print(f"  总盈利: ${gross_profit:.2f}")
            print(f"  总亏损: ${gross_loss:.2f}")
            print(f"  净利润: ${profit_loss:.2f}")
            print(f"  胜率: {win_rate:.1f}%")
            print(f"  Profit Factor: {profit_factor}")
            print(f"  强制平仓PNL: ${forced_liquidation_pnl:.2f}")

            # 计算波动率（基于权益曲线）
            equity_values = [point['equity'] for point in equity_curve]
            if len(equity_values) > 1:
                # 计算日收益率（百分比）
                returns = [(equity_values[i] - equity_values[i-1]) / equity_values[i-1] * 100 for i in range(1, len(equity_values))]

                if len(returns) > 1:
                    # 计算平均日收益率（百分比）
                    mean_return = sum(returns) / len(returns)

                    # 计算样本标准差（波动率）- 使用样本标准差公式
                    variance = sum((r - mean_return) ** 2 for r in returns) / (len(returns) - 1)
                    volatility = variance ** 0.5

                    # 计算下行波动率（只考虑负收益）
                    downside_returns = [r for r in returns if r < 0]
                    if len(downside_returns) > 0:
                        downside_variance = sum(r ** 2 for r in downside_returns) / len(downside_returns)
                        downside_volatility = downside_variance ** 0.5
                    else:
                        downside_volatility = 0
                else:
                    volatility = 0
                    downside_volatility = 0
                    mean_return = returns[0] if returns else 0
            else:
                volatility = 0
                downside_volatility = 0
                mean_return = 0

            # 计算实际交易日数量
            trading_days = len(historical_data)

            # 计算风险调整收益
            # 假设无风险利率为0%
            risk_free_rate = 0

            # 年化因子：√252（假设日数据）
            annualization_factor = (252) ** 0.5 if trading_days > 0 else 1

            # Sharpe Ratio（年化）
            # 公式：(平均日收益率 - 无风险日利率) / 日收益率标准差 * √252
            daily_risk_free = risk_free_rate / 252
            sharpe_ratio = ((mean_return - daily_risk_free) / volatility * annualization_factor) if volatility > 0 else 0

            # Sortino Ratio（年化，使用下行波动率）
            # 公式：(平均日收益率 - 无风险日利率) / 下行波动率 * √252
            sortino_ratio = ((mean_return - daily_risk_free) / downside_volatility * annualization_factor) if downside_volatility > 0 else 0

            # 计算年化收益率
            # 使用复利公式：年化收益率 = ((1 + total_return/100)^(252/trading_days) - 1) * 100
            if trading_days > 0 and total_return != 0:
                total_return_decimal = total_return / 100
                years = trading_days / 252  # 假设252个交易日/年
                annualized_return = ((1 + total_return_decimal) ** (1/years) - 1) * 100 if years > 0 else total_return
            else:
                annualized_return = total_return

            # 生成结果 - 统一口径
            results = {
                # 核心收益指标
                "totalReturn": round(total_return, 2),
                "profitLoss": round(profit_loss, 2),
                "annualizedReturn": round(annualized_return, 2),

                # 风险指标
                "maxDrawdown": round(max_drawdown, 2),
                "volatility": round(volatility, 2),
                "sharpeRatio": round(sharpe_ratio, 2),
                "sortinoRatio": round(sortino_ratio, 2),
                "calmarRatio": round(annualized_return / max(1, max_drawdown), 2),

                # 交易统计 - 统一口径
                "trades": len(completed_trades),  # 已平仓交易数
                "winningTrades": len(winning_trades),
                "losingTrades": len(losing_trades),
                "breakevenTrades": len(breakeven_trades),
                "winRate": round(win_rate, 2),

                # PNL分解 - 统一口径
                "grossProfit": round(gross_profit, 2),
                "grossLoss": round(gross_loss, 2),
                "netProfit": round(profit_loss, 2),  # 与profitLoss一致

                # 交易质量指标
                "avgReturnPerTrade": round(profit_loss / max(1, len(completed_trades)), 2),
                "profitFactor": round(profit_factor, 2) if profit_factor is not None else None,
                "expectancy": round(expectancy, 2),
                "avgWin": round(avg_win, 2) if winning_trades else 0,
                "avgLoss": round(avg_loss, 2) if losing_trades else 0,

                # 其他
                "exposure": round((sum(point['equity'] for point in equity_curve) / len(equity_curve)) / initial_capital * 100, 2) if equity_curve else 0,
                "equityCurve": equity_curve,  # 添加equityCurve字段
                "chartData": chart_data,      # 使用完整的图表数据
                "tradesList": completed_trades,
                "forcedLiquidation": round(forced_liquidation_pnl, 2) if forced_liquidation_pnl != 0 else 0,
                "consistencyCheck": consistency_check
            }

            print(f"[Backtest] 回测完成，总收益: {total_return:.2f}%")

        else:
            print(f"[Backtest] 没有历史数据，返回空结果")
            results = {
                "totalReturn": 0,
                "profitLoss": 0,
                "annualizedReturn": 0,
                "maxDrawdown": 0,
                "volatility": 0,
                "sharpeRatio": 0,
                "sortinoRatio": 0,
                "calmarRatio": 0,
                "winRate": 0,
                "trades": 0,
                "avgReturnPerTrade": 0,
                "profitFactor": 0,
                "expectancy": 0,
                "exposure": 0,
                "chartData": [],
                "tradesList": []
            }

        stage3_time = time.time() - stage3_start
        print(f"[Backtest] 阶段3完成，耗时: {stage3_time:.2f}秒")

        total_time = time.time() - total_start
        print(f"[Backtest] 全部完成，总耗时: {total_time:.2f}秒")

        # 创建返回结果
        result = {
            "success": True,
            "backtestId": backtest_id,
            "results": results,
            "chartData": results["chartData"],
            "trades": results["tradesList"],
            "parameters": {
                "symbol": symbol,
                "symbols": [symbol],
                "strategy": strategy,
                "startDate": start_date,
                "endDate": end_date,
                "period": f"{start_date} to {end_date}",
                "initialCapital": initial_capital,
                "dataMode": "real",
                "dataModeDisplay": "Real Data",
                "dataSource": data_source or "Twelve Data",
                "parameters": parameters  # 添加策略参数
            }
        }

        # 将backtest结果保存到全局history中
        try:
            with backtest_history_lock:
                # 创建history记录
                history_record = {
                    "backtestId": backtest_id,
                    "status": "completed",
                    "createdAt": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
                    "parameters": result["parameters"],
                    "results": results
                }
                
                # 检查是否是完全重复的记录（相同symbol、strategy、参数、结果）
                is_duplicate = False
                for existing in backtest_history[:10]:  # 只检查最近10条记录
                    if (existing.get("parameters", {}).get("symbol") == result["parameters"].get("symbol") and
                        existing.get("parameters", {}).get("strategy") == result["parameters"].get("strategy") and
                        existing.get("parameters", {}).get("startDate") == result["parameters"].get("startDate") and
                        existing.get("parameters", {}).get("endDate") == result["parameters"].get("endDate") and
                        existing.get("results", {}).get("totalReturn") == results.get("totalReturn")):
                        
                        # 如果是完全重复的记录，更新创建时间但不新增
                        existing["createdAt"] = history_record["createdAt"]
                        print(f"[Backtest History] 更新重复记录时间: {backtest_id}")
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    # 添加到history列表开头（最新记录在前）
                    backtest_history.insert(0, history_record)
                    
                    # 限制history大小
                    if len(backtest_history) > MAX_HISTORY_SIZE:
                        backtest_history.pop()  # 移除最旧的记录
                    
                    print(f"[Backtest History] 已保存backtest记录: {backtest_id}")
                    print(f"[Backtest History] 当前history大小: {len(backtest_history)}")
                else:
                    print(f"[Backtest History] 跳过重复记录: {backtest_id}")
        except Exception as e:
            print(f"[Backtest History] 保存失败: {e}")
        
        return jsonify(result)

    except Exception as e:
        total_time = time.time() - total_start
        print(f"[Backtest] 异常: {str(e)}，总耗时: {total_time:.2f}秒")
        return jsonify({
            "success": False,
            "error": str(e),
            "backtestId": "error-" + str(int(time.time())),
            "results": None,
            "chartData": None,
            "trades": None,
            "parameters": None
        }), 500

def generate_simulation_result(strategy, rank, params, initial_capital):
    """生成模拟的优化结果"""
    import random
    random_factor = random.uniform(0.8, 1.2)
    
    # 基础性能指标
    if strategy == 'moving_average':
        short_ma = params.get('short_ma', 20)
        long_ma = params.get('long_ma', 50)
        base_return = 5.0 + (short_ma / 10.0) + (long_ma / 50.0)
        volatility = 0.5 + (short_ma / 100.0)
    elif strategy == 'rsi':
        rsi_period = params.get('rsi_period', 14)
        oversold = params.get('oversold', 30)
        overbought = params.get('overbought', 70)
        base_return = 4.0 + (rsi_period / 20.0) + ((overbought - oversold) / 10.0)
        volatility = 0.4 + (rsi_period / 150.0)
    elif strategy == 'macd':
        fast = params.get('fast', 12)
        slow = params.get('slow', 26)
        signal = params.get('signal', 9)
        base_return = 3.0 + (fast / 15.0) + (slow / 30.0) + (signal / 20.0)
        volatility = 0.3 + (fast / 200.0)
    elif strategy == 'bollinger':
        period = params.get('period', 20)
        std_dev = params.get('std_dev', 2.0)
        base_return = 2.5 + (period / 25.0) + (std_dev / 2.0)
        volatility = 0.35 + (period / 180.0)
    elif strategy == 'momentum':
        momentum_period = params.get('momentum_period', 10)
        base_return = 2.0 + (momentum_period / 15.0)
        volatility = 0.25 + (momentum_period / 200.0)
    else:
        base_return = 5.0
        volatility = 0.5
    
    sharpe_ratio = base_return / max(volatility, 0.1)
    
    result = {
        'rank': rank,
        'totalReturn': round(base_return * random_factor, 2),
        'annualizedReturn': round(base_return * random_factor * 1.2, 2),
        'sharpeRatio': round(sharpe_ratio * random_factor, 3),
        'maxDrawdown': round(-abs(base_return * 0.3 * random_factor), 2),
        'trades': random.randint(10, 50),
        'winRate': round(random.uniform(40, 70), 1),
        'profitLoss': round(base_return * initial_capital / 100 * random_factor, 2),
        'volatility': round(volatility * random_factor, 3),
        'sortinoRatio': round(sharpe_ratio * 1.1 * random_factor, 3),
        'profitFactor': round(random.uniform(1.2, 2.5), 2),
        'expectancy': round(base_return * 0.1 * random_factor, 3),
        'exposure': round(random.uniform(20, 80), 1)
    }
    
    # 添加策略特定的参数
    if strategy == 'moving_average':
        result['short_ma'] = params.get('short_ma')
        result['long_ma'] = params.get('long_ma')
    elif strategy == 'rsi':
        result['rsi_period'] = params.get('rsi_period')
        result['oversold'] = params.get('oversold')
        result['overbought'] = params.get('overbought')
    elif strategy == 'macd':
        result['fast'] = params.get('fast')
        result['slow'] = params.get('slow')
        result['signal'] = params.get('signal')
    elif strategy == 'bollinger':
        result['period'] = params.get('period')
        result['std_dev'] = params.get('std_dev')
    elif strategy == 'momentum':
        result['momentum_period'] = params.get('momentum_period')
    
    return result

@app.route('/backtest/history', methods=['GET'])
@app.route('/api/backtest/history', methods=['GET'])
def get_backtest_history():
    """获取回测历史 - 返回真实的backtest历史数据"""
    try:
        print(f"[Backtest History] 收到回测历史请求")
        print(f"[Backtest History] backtest_history id: {id(backtest_history)}")
        print(f"[Backtest History] backtest_history 大小: {len(backtest_history)}")
        
        # 使用全局的backtest_history数据
        with backtest_history_lock:
            # 返回最新的历史记录（按createdAt倒序）
            sorted_history = sorted(
                backtest_history,
                key=lambda x: x.get("createdAt", ""),
                reverse=True
            )
            
            print(f"[Backtest History] 返回 {len(sorted_history)} 条真实回测历史记录")
            
            # 如果没有真实历史数据，返回空数组
            if len(sorted_history) == 0:
                print(f"[Backtest History] 没有真实回测历史数据")
                return jsonify({
                    "success": True,
                    "history": [],
                    "count": 0,
                    "message": "No real backtest history available"
                }), 200
            
            return jsonify({
                "success": True,
                "history": sorted_history,
                "count": len(sorted_history),
                "message": f"Found {len(sorted_history)} real backtest records"
            }), 200
        
    except Exception as e:
        print(f"[Backtest History] 异常: {e}")
        return jsonify({
            "success": False,
            "error": str(e),
            "history": [],
            "count": 0,
            "message": "Error loading backtest history"
        }), 500
            'history': [],
            'count': 0
        }), 500

@app.route('/backtest/optimize', methods=['POST'])
@app.route('/api/backtest/optimize', methods=['POST'])
def run_parameter_optimization():
    """运行参数优化 - 模拟版本，返回模拟数据"""
    total_start = time.time()

    try:
        data = request.get_json()
        print(f"[Optimization] 收到参数优化请求: {data}")

        # 提取配置
        symbol = data.get('symbol', 'AAPL')
        strategy = data.get('strategy', 'moving_average')
        start_date = data.get('startDate', '2024-01-01')
        end_date = data.get('endDate', '2024-12-31')
        initial_capital = data.get('initialCapital', 100000)

        # 参数范围 - 根据策略提取不同的参数
        strategy = data.get('strategy', 'moving_average')

        if strategy == 'moving_average':
            short_ma_range = data.get('shortMaRange', {'start': 5, 'end': 50, 'step': 5})
            long_ma_range = data.get('longMaRange', {'start': 50, 'end': 200, 'step': 25})
            param_ranges = {'short_ma': short_ma_range, 'long_ma': long_ma_range}
        elif strategy == 'rsi':
            rsi_period_range = data.get('rsiPeriodRange', {'start': 10, 'end': 30, 'step': 2})
            oversold_range = data.get('oversoldRange', {'start': 20, 'end': 40, 'step': 5})
            overbought_range = data.get('overboughtRange', {'start': 60, 'end': 80, 'step': 5})
            param_ranges = {'rsi_period': rsi_period_range, 'oversold': oversold_range, 'overbought': overbought_range}
        elif strategy == 'macd':
            fast_range = data.get('fastRange', {'start': 8, 'end': 20, 'step': 2})
            slow_range = data.get('slowRange', {'start': 21, 'end': 35, 'step': 3})
            signal_range = data.get('signalRange', {'start': 5, 'end': 15, 'step': 2})
            param_ranges = {'fast': fast_range, 'slow': slow_range, 'signal': signal_range}
        elif strategy == 'bollinger':
            period_range = data.get('periodRange', {'start': 10, 'end': 30, 'step': 2})
            std_dev_range = data.get('stdDevRange', {'start': 1.5, 'end': 3.0, 'step': 0.5})
            param_ranges = {'period': period_range, 'std_dev': std_dev_range}
        elif strategy == 'momentum':
            momentum_period_range = data.get('momentumPeriodRange', {'start': 5, 'end': 30, 'step': 5})
            param_ranges = {'momentum_period': momentum_period_range}
        else:
            # 默认使用MA参数
            short_ma_range = data.get('shortMaRange', {'start': 5, 'end': 50, 'step': 5})
            long_ma_range = data.get('longMaRange', {'start': 50, 'end': 200, 'step': 25})
            param_ranges = {'short_ma': short_ma_range, 'long_ma': long_ma_range}
            strategy = 'moving_average'  # 强制使用MA策略

        # 生成优化ID
        import uuid
        optimization_id = str(uuid.uuid4())[:8]

        print(f"[Optimization] 开始处理参数优化，ID: {optimization_id}")
        print(f"[Optimization] 策略: {strategy}")
        print(f"[Optimization] 参数范围: {param_ranges}")

        # 生成模拟的优化结果
        results = []
        rank = 1
        
        # 根据策略生成参数组合
        if strategy == 'moving_average':
            short_values = list(range(param_ranges['short_ma']['start'], param_ranges['short_ma']['end'] + 1, param_ranges['short_ma']['step']))
            long_values = list(range(param_ranges['long_ma']['start'], param_ranges['long_ma']['end'] + 1, param_ranges['long_ma']['step']))
            
            print(f"[Optimization] 生成 {len(short_values)} x {len(long_values)} = {len(short_values) * len(long_values)} 个组合的模拟数据")
            
            for short_ma in short_values:
                for long_ma in long_values:
                    if short_ma >= long_ma:
                        continue  # 跳过无效组合（短期MA必须小于长期MA）
                    
                    result = generate_simulation_result(strategy, rank, {'short_ma': short_ma, 'long_ma': long_ma}, initial_capital)
                    results.append(result)
                    rank += 1
                    
        elif strategy == 'rsi':
            rsi_period_values = list(range(param_ranges['rsi_period']['start'], param_ranges['rsi_period']['end'] + 1, param_ranges['rsi_period']['step']))
            oversold_values = list(range(param_ranges['oversold']['start'], param_ranges['oversold']['end'] + 1, param_ranges['oversold']['step']))
            overbought_values = list(range(param_ranges['overbought']['start'], param_ranges['overbought']['end'] + 1, param_ranges['overbought']['step']))
            
            total_combinations = len(rsi_period_values) * len(oversold_values) * len(overbought_values)
            print(f"[Optimization] 生成 {len(rsi_period_values)} x {len(oversold_values)} x {len(overbought_values)} = {total_combinations} 个组合的模拟数据")
            
            # 限制组合数量，避免太多
            max_combinations = 1000
            count = 0
            for rsi_period in rsi_period_values:
                for oversold in oversold_values:
                    for overbought in overbought_values:
                        if oversold >= overbought:
                            continue  # 跳过无效组合（超卖必须小于超买）
                        
                        if count >= max_combinations:
                            break
                        
                        result = generate_simulation_result(strategy, rank, {'rsi_period': rsi_period, 'oversold': oversold, 'overbought': overbought}, initial_capital)
                        results.append(result)
                        rank += 1
                        count += 1
                        
        elif strategy == 'macd':
            fast_values = list(range(param_ranges['fast']['start'], param_ranges['fast']['end'] + 1, param_ranges['fast']['step']))
            slow_values = list(range(param_ranges['slow']['start'], param_ranges['slow']['end'] + 1, param_ranges['slow']['step']))
            signal_values = list(range(param_ranges['signal']['start'], param_ranges['signal']['end'] + 1, param_ranges['signal']['step']))
            
            total_combinations = len(fast_values) * len(slow_values) * len(signal_values)
            print(f"[Optimization] 生成 {len(fast_values)} x {len(slow_values)} x {len(signal_values)} = {total_combinations} 个组合的模拟数据")
            
            # 限制组合数量，避免太多
            max_combinations = 1000
            count = 0
            for fast in fast_values:
                for slow in slow_values:
                    for signal in signal_values:
                        if fast >= slow:
                            continue  # 跳过无效组合（快线必须小于慢线）
                        
                        if count >= max_combinations:
                            break
                        
                        result = generate_simulation_result(strategy, rank, {'fast': fast, 'slow': slow, 'signal': signal}, initial_capital)
                        results.append(result)
                        rank += 1
                        count += 1
                        
        elif strategy == 'bollinger':
            period_values = list(range(param_ranges['period']['start'], param_ranges['period']['end'] + 1, param_ranges['period']['step']))
            std_dev_values = []
            current = param_ranges['std_dev']['start']
            while current <= param_ranges['std_dev']['end'] + 0.001:  # 处理浮点数精度
                std_dev_values.append(round(current, 2))
                current += param_ranges['std_dev']['step']
            
            total_combinations = len(period_values) * len(std_dev_values)
            print(f"[Optimization] 生成 {len(period_values)} x {len(std_dev_values)} = {total_combinations} 个组合的模拟数据")
            
            for period in period_values:
                for std_dev in std_dev_values:
                    result = generate_simulation_result(strategy, rank, {'period': period, 'std_dev': std_dev}, initial_capital)
                    results.append(result)
                    rank += 1
                    
        elif strategy == 'momentum':
            momentum_period_values = list(range(param_ranges['momentum_period']['start'], param_ranges['momentum_period']['end'] + 1, param_ranges['momentum_period']['step']))
            
            print(f"[Optimization] 生成 {len(momentum_period_values)} 个组合的模拟数据")
            
            for momentum_period in momentum_period_values:
                result = generate_simulation_result(strategy, rank, {'momentum_period': momentum_period}, initial_capital)
                results.append(result)
                rank += 1

        # 按夏普比率排序
        results.sort(key=lambda x: x['sharpeRatio'], reverse=True)

        # 更新排名
        for i, result in enumerate(results):
            result['rank'] = i + 1

        total_time = time.time() - total_start
        print(f"[Optimization] 完成，生成 {len(results)} 个结果，耗时: {total_time:.2f}秒")

        return jsonify({
            "success": True,
            "optimizationId": optimization_id,
            "results": results,
            "summary": {
                "totalCombinations": len(results) * 2,  # 模拟值
                "validCombinations": len(results),
                "bestSharpeRatio": results[0]['sharpeRatio'] if results else 0,
                "bestTotalReturn": results[0]['totalReturn'] if results else 0,
                "worstTotalReturn": results[-1]['totalReturn'] if results else 0,
                "avgTotalReturn": sum(r['totalReturn'] for r in results) / len(results) if results else 0
            },
            "parameters": {
                "symbol": symbol,
                "strategy": strategy,
                "startDate": start_date,
                "endDate": end_date,
                "initialCapital": initial_capital,
                "paramRanges": param_ranges
            }
        })

    except Exception as e:
        total_time = time.time() - total_start
        print(f"[Optimization] 异常: {str(e)}，耗时: {total_time:.2f}秒")
        return jsonify({
            "success": False,
            "error": str(e),
            "optimizationId": "error-" + str(int(time.time())),
            "results": [],
            "summary": None,
            "parameters": None
        }), 500

# ==================== Portfolio History 接口 ====================

@app.route('/api/ai/alpaca/portfolio/history', methods=['GET'])
def ai_alpaca_portfolio_history():
    print('=== AI Alpaca Portfolio History 请求 ===')
    range_param = request.args.get('range', '1D')

    try:
        # 尝试使用真实的 Alpaca API
        environment = alpaca_config_state.get('environment', 'paper')

        if environment == 'paper':
            api_key = alpaca_config_state.get('paper_api_key')
            api_secret = alpaca_config_state.get('paper_api_secret')
            base_url = 'https://paper-api.alpaca.markets'
        else:
            api_key = alpaca_config_state.get('live_api_key')
            api_secret = alpaca_config_state.get('live_api_secret')
            base_url = 'https://api.alpaca.markets'

        # 如果没有配置API密钥，返回空数据
        if not api_key or not api_secret:
            print('Alpaca API 密钥未配置，无法获取portfolio历史数据')
            return jsonify({
                'success': False,
                'data': [],
                'count': 0,
                'range': range_param,
                'isMockData': False,
                'message': 'Alpaca API 密钥未配置，请先配置API密钥'
            })

        # 调用真实的 Alpaca API 获取账户活动（portfolio历史）
        headers = {
            'APCA-API-KEY-ID': api_key,
            'APCA-API-SECRET-KEY': api_secret
        }

        # 计算时间范围
        import datetime
        end_date = datetime.datetime.now()

        if range_param == '1D':
            start_date = end_date - datetime.timedelta(days=1)
        elif range_param == '1W':
            start_date = end_date - datetime.timedelta(weeks=1)
        elif range_param == '1M':
            start_date = end_date - datetime.timedelta(days=30)
        elif range_param == '1Y':
            start_date = end_date - datetime.timedelta(days=365)
        else:  # All
            start_date = end_date - datetime.timedelta(days=365 * 2)  # 2年

        # 根据Alpaca API文档设置正确的参数
        # Alpaca portfolio history接口参数:
        # - period: 1D, 1W, 1M, 1A (1年), 5Y, 10Y
        # - timeframe: 1Min, 5Min, 15Min, 1H, 1D
        # - intraday_reporting: market_hours (默认) 或 continuous
        # - start/end: ISO 8601格式，America/New_York时区

        # 设置period和timeframe映射
        period_map = {
            '1D': '1D',
            '1W': '1W',
            '1M': '1M',
            '1Y': '1A',  # Alpaca使用1A表示1年
            'All': None  # All不使用period，使用start/end
        }

        timeframe_map = {
            '1D': '1Min',  # 1D使用1分钟粒度
            '1W': '1H',    # 1W使用小时粒度
            '1M': '1D',    # 1M使用日粒度
            '1Y': '1D',    # 1Y使用日粒度
            'All': '1D'    # All使用日粒度
        }

        period = period_map.get(range_param)
        timeframe = timeframe_map.get(range_param, '1Min')

        # 构建查询参数
        params = {
            'timeframe': timeframe,
            'intraday_reporting': 'market_hours'  # 使用市场时间，不包括盘前盘后
        }

        # 添加period参数（除了All）
        if period:
            params['period'] = period

        # 对于All，使用start/end参数
        if range_param == 'All':
            # 设置开始时间为账户创建时间或2年前
            import datetime
            end_date = datetime.datetime.now()
            start_date = end_date - datetime.timedelta(days=365 * 2)  # 2年
            params['start'] = start_date.strftime('%Y-%m-%d')
            params['end'] = end_date.strftime('%Y-%m-%d')

        print(f'=== 调用 Alpaca portfolio history API ===')
        print(f'URL: {base_url}/v2/account/portfolio/history')
        print(f'Params: {params}')
        print(f'API Key: {api_key[:6]}...{api_key[-4:]}')
        print(f'Environment: {environment}')

        response = requests.get(f'{base_url}/v2/account/portfolio/history', headers=headers, params=params, timeout=10)

        print(f'响应状态码: {response.status_code}')

        if response.status_code == 200:
            history_data = response.json()
            print(f'✅ 获取到portfolio历史数据')

            # 详细打印原始返回数据
            print(f'原始返回数据keys: {list(history_data.keys())}')

            # 检查timestamp
            if 'timestamp' in history_data:
                timestamps = history_data.get('timestamp', [])
                print(f'timestamp数组长度: {len(timestamps)}')
                if len(timestamps) > 0:
                    print(f'前5个timestamp: {timestamps[:5]}')
                    print(f'后5个timestamp: {timestamps[-5:]}')
                    # 转换为可读时间
                    import datetime
                    try:
                        print('转换为可读时间 (America/New_York):')
                        for i, ts in enumerate(timestamps[:3]):
                            dt = datetime.datetime.fromtimestamp(ts)
                            print(f'  [{i}] {ts} -> {dt.strftime("%Y-%m-%d %H:%M:%S")}')
                        if len(timestamps) > 3:
                            print(f'  ...')
                            for i in range(-3, 0):
                                ts = timestamps[i]
                                dt = datetime.datetime.fromtimestamp(ts)
                                print(f'  [{len(timestamps)+i}] {ts} -> {dt.strftime("%Y-%m-%d %H:%M:%S")}')
                    except Exception as e:
                        print(f'时间转换错误: {e}')
            else:
                print('❌ 没有timestamp字段')

            # 检查equity
            if 'equity' in history_data:
                equities = history_data.get('equity', [])
                print(f'equity数组长度: {len(equities)}')
                if len(equities) > 0:
                    print(f'前5个equity: {equities[:5]}')
                    print(f'后5个equity: {equities[-5:]}')
                    # 检查equity值变化
                    if len(equities) > 1:
                        print('equity值变化检查:')
                        for i in range(min(5, len(equities)-1)):
                            change = equities[i+1] - equities[i]
                            print(f'  [{i}] ${equities[i]:.2f} -> [{i+1}] ${equities[i+1]:.2f} (变化: ${change:.2f})')
            else:
                print('❌ 没有equity字段')

            # 检查profit_loss
            if 'profit_loss' in history_data:
                profit_loss = history_data.get('profit_loss', [])
                print(f'profit_loss数组长度: {len(profit_loss)}')
                if len(profit_loss) > 0:
                    print(f'前5个profit_loss: {profit_loss[:5]}')

            # 检查profit_loss_pct
            if 'profit_loss_pct' in history_data:
                profit_loss_pct = history_data.get('profit_loss_pct', [])
                print(f'profit_loss_pct数组长度: {len(profit_loss_pct)}')
                if len(profit_loss_pct) > 0:
                    print(f'前5个profit_loss_pct: {profit_loss_pct[:5]}')

            # 检查base_value
            if 'base_value' in history_data:
                print(f'base_value: {history_data.get("base_value")}')

            # 检查base_timestamp
            if 'base_timestamp' in history_data:
                print(f'base_timestamp: {history_data.get("base_timestamp")}')

            # 检查数组长度是否匹配
            if 'timestamp' in history_data and 'equity' in history_data:
                ts_len = len(history_data.get('timestamp', []))
                eq_len = len(history_data.get('equity', []))
                if ts_len != eq_len:
                    print(f'⚠️ 警告: timestamp长度({ts_len}) != equity长度({eq_len})')
                else:
                    print(f'✅ timestamp和equity长度匹配: {ts_len}')
        else:
            print(f'❌ Alpaca API 调用失败')
            print(f'响应内容: {response.text[:1000]}')

            # 处理portfolio历史数据
            data = []
            if 'timestamp' in history_data and 'equity' in history_data:
                timestamps = history_data.get('timestamp', [])
                equities = history_data.get('equity', [])
                profit_loss = history_data.get('profit_loss', [])
                profit_loss_pct = history_data.get('profit_loss_pct', [])

                print('处理数据...')
                print('timestamps长度:', len(timestamps))
                print('equities长度:', len(equities))
                print('profit_loss长度:', len(profit_loss))
                print('profit_loss_pct长度:', len(profit_loss_pct))

                # 检查是否有基准值信息
                if 'base_value' in history_data:
                    print('base_value:', history_data['base_value'])
                if 'base_timestamp' in history_data:
                    print('base_timestamp:', history_data['base_timestamp'])

                print(f'开始处理数据点...')
                valid_points = 0
                for i in range(len(timestamps)):
                    timestamp = timestamps[i]
                    equity = equities[i] if i < len(equities) else 0
                    pl = profit_loss[i] if i < len(profit_loss) else None
                    pl_pct = profit_loss_pct[i] if i < len(profit_loss_pct) else None

                    # 只添加有效的数据点
                    if timestamp and equity is not None:
                        # Alpaca返回的时间戳是Unix秒，转换为毫秒
                        timestamp_ms = int(timestamp) * 1000
                        data.append({
                            'timestamp': timestamp_ms,  # 转换为毫秒
                            'equity': float(equity),    # 主曲线数据字段
                            'pnl': float(pl) if pl is not None else 0,
                            'pnlPct': float(pl_pct) if pl_pct is not None else 0,
                            'isMockData': False
                        })
                        valid_points += 1

                        # 打印前几个点的详细信息
                        if valid_points <= 3:
                            import datetime
                            dt = datetime.datetime.fromtimestamp(timestamp)
                            print(f'  点[{i}]: timestamp={timestamp} -> {dt.strftime("%Y-%m-%d %H:%M:%S")}, equity=${equity:.2f}')

                print(f'处理完成，有效数据点: {valid_points}/{len(timestamps)}')

                print(f'处理后的数据点数量: {len(data)}')

                if len(data) > 0:
                    # 计算总变化 - 使用Alpaca提供的profit_loss_pct或自己计算
                    first_value = data[0]['equity'] if data else 0
                    last_value = data[-1]['equity'] if data else 0
                    total_change = last_value - first_value
                    total_change_pct = (total_change / first_value * 100) if first_value > 0 else 0

                    # 如果有profit_loss_pct，使用最后一个点的值
                    last_pl_pct = data[-1].get('pnlPct')
                    if last_pl_pct is not None:
                        total_change_pct = last_pl_pct * 100  # 转换为百分比
                        print(f'使用Alpaca profit_loss_pct: {last_pl_pct} -> {total_change_pct:.4f}%')

                    return jsonify({
                        'success': True,
                        'data': data,
                        'count': len(data),
                        'range': range_param,
                        'isMockData': False,
                        'total_change': round(total_change, 2),
                        'total_change_pct': round(total_change_pct, 4),
                        'first_value': round(first_value, 2),
                        'last_value': round(last_value, 2),
                        'message': '获取portfolio历史数据成功'
                    })

            # 如果没有有效数据，返回空数据
            print('Alpaca portfolio history接口返回了数据，但格式不正确或为空')
            return jsonify({
                'success': True,
                'data': [],
                'count': 0,
                'range': range_param,
                'isMockData': False,
                'message': 'Alpaca portfolio历史数据为空'
            })

        # API调用失败时返回空数据，不再返回模拟数据
        print(f'Alpaca portfolio history API 调用失败: {response.status_code} - {response.text}')
        return jsonify({
            'success': False,
            'data': [],
            'count': 0,
            'range': range_param,
            'isMockData': False,
            'message': f'Alpaca portfolio history API 调用失败 ({response.status_code})，请检查API密钥和网络连接'
        })

    except Exception as e:
        print(f'Alpaca portfolio history 接口错误: {e}')
        # 异常时返回空数据，不再返回模拟数据
        return jsonify({
            'success': False,
            'data': [],
            'count': 0,
            'range': range_param,
            'isMockData': False,
            'message': f'接口异常: {str(e)}'
        })

# ==================== 启动 ====================
if __name__ == '__main__':
    print("================================================================================")
    print("简化版后端启动 - 包含 AI 接口")
    print("端口: 8889")
    print("包含接口:")
    print("  1. AI 配置接口:")
    print("     - POST /api/ai/provider/config - DeepSeek 配置保存")
    print("     - POST /api/ai/provider/test - DeepSeek API 测试")
    print("  2. AI Alpaca 交易接口:")
    print("     - GET /api/ai/alpaca/account - AI Alpaca 账户")
    print("     - GET /api/ai/alpaca/positions - AI Alpaca 持仓")
    print("     - GET /api/ai/alpaca/orders - AI Alpaca 订单")
    print("     - GET /api/ai/alpaca/orders/history - AI Alpaca 历史订单")
    print("     - GET /api/ai/alpaca/portfolio/history - AI Alpaca Portfolio 历史")
    print("  3. AI Trading 接口:")
    print("     - POST /api/ai/trade/preview - AI 交易预览")
    print("     - GET /api/ai/trade/status - AI 交易状态")
    print("     - GET /api/ai/trade/history - AI 交易历史")
    print("     - POST /api/ai/trade/toggle - AI 交易开关")
    print("     - POST /api/ai/trade/execute - AI 交易执行")
    print("     - GET/POST /api/ai/trading/environment - AI 交易环境")
    print("  4. AI 聊天接口:")
    print("     - POST /api/ai/chat - AI 聊天")
    print("  5. 基础接口:")
    print("     - GET /api/status - 系统状态")
    print("     - GET /api/market/stocks - 股票列表")
    print("     - GET /api/market/stock/<symbol> - 股票详情")
    print("     - POST /api/backtest/run - 运行回测")
    print("================================================================================")

    # 添加调试信息
    print("\n调试信息:")
    print(f"已注册路由数量: {len(app.url_map._rules)}")
    print("检查特定路由:")
    for rule in app.url_map.iter_rules():
        if 'ai/trade' in rule.rule:
            print(f"  {rule.rule} -> {rule.endpoint}")

    print("\n启动服务器...")
    app.run(host='127.0.0.1', port=8892, debug=True)  # 启用debug模式，使用新端口避免冲突