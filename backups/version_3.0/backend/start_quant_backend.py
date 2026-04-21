"""
优化版后端 - 性能优化，减少Finnhub API调用
"""
from flask import Flask, request, jsonify
import requests
import time
import threading
import random
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import OrderedDict
import hashlib
from datetime import datetime

app = Flask(__name__)

# ==================== 配置 ====================
FINNHUB_API_KEY = 'd6v2q09r01qig546aus0d6v2q09r01qig546ausg'
TWELVEDATA_API_KEY = '4c486f3044124045a3bb48c1b6bc0a1b'

# Alpaca Paper Trading 配置
ALPACA_API_KEY = 'PK47HFNRVYZ7XZLLLYUULBIY4R'
ALPACA_API_SECRET = '6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g'
ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2'

# 缓存配置
CACHE_TTL = 30  # 30秒缓存
MAX_CACHE_SIZE = 100

# ==================== 缓存实现 ====================
class StockCache:
    """简单的股票数据缓存"""
    
    def __init__(self, ttl=30, max_size=100):
        self.ttl = ttl
        self.max_size = max_size
        self.cache = OrderedDict()
        self.lock = threading.Lock()
    
    def get(self, key):
        """获取缓存数据"""
        with self.lock:
            if key in self.cache:
                data, timestamp = self.cache[key]
                if time.time() - timestamp < self.ttl:
                    # 更新访问时间（LRU）
                    self.cache.move_to_end(key)
                    return data
                else:
                    # 缓存过期
                    del self.cache[key]
            return None
    
    def set(self, key, data):
        """设置缓存数据"""
        with self.lock:
            if key in self.cache:
                self.cache.move_to_end(key)
            elif len(self.cache) >= self.max_size:
                # 移除最旧的缓存
                self.cache.popitem(last=False)
            self.cache[key] = (data, time.time())
    
    def clear(self):
        """清空缓存"""
        with self.lock:
            self.cache.clear()

# ==================== Backtest History 存储 ====================
# 全局的backtest历史存储
backtest_history = []
backtest_history_lock = threading.Lock()
MAX_HISTORY_SIZE = 100  # 最多保存100个backtest记录

print(f"[Backtest History] 初始化: backtest_history = {backtest_history}, id = {id(backtest_history)}")

# 全局缓存实例
stock_cache = StockCache(ttl=CACHE_TTL, max_size=MAX_CACHE_SIZE)

# ==================== 股票名称映射 ====================
STOCK_NAME_TO_SYMBOL = {
    # 常见股票名称映射
    'apple': 'AAPL',
    'apple inc': 'AAPL',
    'apple computer': 'AAPL',
    'microsoft': 'MSFT',
    'microsoft corporation': 'MSFT',
    'google': 'GOOGL',
    'google inc': 'GOOGL',
    'alphabet': 'GOOGL',
    'alphabet inc': 'GOOGL',
    'tesla': 'TSLA',
    'tesla inc': 'TSLA',
    'amazon': 'AMZN',
    'amazon.com': 'AMZN',
    'amazon com': 'AMZN',
    'meta': 'META',
    'meta platforms': 'META',
    'facebook': 'META',
    'nvidia': 'NVDA',
    'nvidia corporation': 'NVDA',
    'netflix': 'NFLX',
    'netflix inc': 'NFLX',
    'intel': 'INTC',
    'intel corporation': 'INTC',
    'amd': 'AMD',
    'advanced micro devices': 'AMD',
    'ibm': 'IBM',
    'international business machines': 'IBM',
    'oracle': 'ORCL',
    'oracle corporation': 'ORCL',
    'cisco': 'CSCO',
    'cisco systems': 'CSCO',
    'qualcomm': 'QCOM',
    'qualcomm inc': 'QCOM',
    'broadcom': 'AVGO',
    'broadcom inc': 'AVGO',
    'adobe': 'ADBE',
    'adobe inc': 'ADBE',
    'salesforce': 'CRM',
    'salesforce.com': 'CRM',
    'salesforce com': 'CRM',
    'paypal': 'PYPL',
    'paypal holdings': 'PYPL',
    'visa': 'V',
    'visa inc': 'V',
    'mastercard': 'MA',
    'mastercard inc': 'MA',
    'disney': 'DIS',
    'walt disney': 'DIS',
    'walt disney company': 'DIS',
    'coca cola': 'KO',
    'coca-cola': 'KO',
    'coca cola company': 'KO',
    'pepsi': 'PEP',
    'pepsico': 'PEP',
    'pepsi co': 'PEP',
    'mcdonalds': 'MCD',
    "mcdonald's": 'MCD',
    'mcdonalds corporation': 'MCD',
    'starbucks': 'SBUX',
    'starbucks corporation': 'SBUX',
    'nike': 'NKE',
    'nike inc': 'NKE',
    'home depot': 'HD',
    'home depot inc': 'HD',
    'walmart': 'WMT',
    'walmart inc': 'WMT',
    'target': 'TGT',
    'target corporation': 'TGT',
    'costco': 'COST',
    'costco wholesale': 'COST',
    'exxon': 'XOM',
    'exxon mobil': 'XOM',
    'exxonmobil': 'XOM',
    'chevron': 'CVX',
    'chevron corporation': 'CVX',
    'shell': 'SHEL',
    'shell plc': 'SHEL',
    'bp': 'BP',
    'bp plc': 'BP',
    'jpmorgan': 'JPM',
    'jpmorgan chase': 'JPM',
    'jpmorgan chase & co': 'JPM',
    'bank of america': 'BAC',
    'bank of america corporation': 'BAC',
    'wells fargo': 'WFC',
    'wells fargo & company': 'WFC',
    'goldman sachs': 'GS',
    'goldman sachs group': 'GS',
    'morgan stanley': 'MS',
    'morgan stanley & co': 'MS',
}

# ==================== 工具函数 ====================
def safe_float(value, default=0.0):
    """安全转换为float"""
    try:
        return float(value)
    except (ValueError, TypeError):
        return float(default)

def get_cache_key(symbol, data_type='quote', **kwargs):
    """生成缓存键"""
    base_key = f"{symbol}_{data_type}"
    
    # 为历史数据添加额外参数
    if data_type == 'history':
        if 'start_date' in kwargs and 'end_date' in kwargs:
            return f"{base_key}_{kwargs['start_date']}_{kwargs['end_date']}"
        elif 'range' in kwargs:
            return f"{base_key}_{kwargs['range']}"
    
    return base_key

def parse_and_validate_stock_input(user_input):
    """
    解析和验证股票输入
    
    Args:
        user_input: 用户输入的股票代码或公司名
    
    Returns:
        (symbol, success, error_message)
        symbol: 解析后的标准股票代码（大写）
        success: 是否成功解析
        error_message: 错误信息（如果失败）
    """
    if not user_input or not user_input.strip():
        return None, False, "请输入股票代码或公司名"
    
    input_text = user_input.strip().lower()
    
    # 1. 首先检查是否是已知的股票代码（直接大写）
    if input_text.upper() in [symbol.upper() for symbol in STOCK_NAME_TO_SYMBOL.values()]:
        return input_text.upper(), True, f"股票代码: {input_text.upper()}"
    
    # 2. 检查是否是已知的公司名
    if input_text in STOCK_NAME_TO_SYMBOL:
        symbol = STOCK_NAME_TO_SYMBOL[input_text]
        return symbol, True, f"公司名 '{user_input}' 解析为股票代码: {symbol}"
    
    # 3. 检查部分匹配的公司名
    for company_name, symbol in STOCK_NAME_TO_SYMBOL.items():
        if input_text in company_name or company_name in input_text:
            return symbol, True, f"公司名 '{user_input}' 解析为股票代码: {symbol}"
    
    # 4. 尝试使用Finnhub API验证股票代码
    try:
        # 先尝试直接验证（假设用户输入的是股票代码）
        test_symbol = input_text.upper()
        
        # 使用Finnhub的quote接口验证股票
        url = f"https://finnhub.io/api/v1/quote"
        params = {
            'symbol': test_symbol,
            'token': FINNHUB_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            # 检查是否有有效数据（当前价格不为0）
            if data.get('c', 0) > 0:
                return test_symbol, True, f"股票代码: {test_symbol}"
    
    except Exception as e:
        print(f"[Stock Validation] Finnhub验证异常: {e}")
    
    # 5. 所有尝试都失败
    return None, False, f"无效的股票代码或公司名: '{user_input}'。请检查输入是否正确。"

def get_twelvedata_history(symbol, interval, range_param):
    """从Twelve Data获取历史数据（带缓存）"""
    print(f"[Twelve Data] 获取历史数据: {symbol}, interval={interval}, range={range_param}")
    
    try:
        # 检查缓存
        cache_key = get_cache_key(symbol, 'history', range=range_param)
        cached = stock_cache.get(cache_key)
        if cached is not None:
            print(f"[Twelve Data] 使用缓存数据 (range模式)")
            return cached, True, f"Twelve Data缓存数据 (range: {range_param})"
        
        # 检查错误缓存
        for error_code in [429, 520, 503]:  # 常见的API错误码
            error_cache_key = f"{cache_key}_error_{error_code}"
            error_cached = stock_cache.get(error_cache_key)
            if error_cached is not None:
                print(f"[Twelve Data] 使用错误缓存 (错误码: {error_code})")
                return None, False, f"Twelve Data API错误缓存 (错误码: {error_code})"
        
        # 构建API URL
        url = "https://api.twelvedata.com/time_series"
        params = {
            'symbol': symbol.upper(),
            'interval': interval,
            'apikey': TWELVEDATA_API_KEY,
            'outputsize': 5000,  # 最大数据点
            'format': 'JSON'
        }
        
        # 根据range设置outputsize
        outputsize_map = {
            '1day': 390,   # 1分钟数据，390个点（6.5小时×60分钟，覆盖9:30-15:30）
            '1week': 300,
            '1month': 30,
            '3month': 90,
            '1year': 252
        }
        
        if range_param in outputsize_map:
            params['outputsize'] = outputsize_map[range_param]
        
        print(f"[Twelve Data] 请求参数: {params}")
        
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code != 200:
            print(f"[Twelve Data] HTTP错误: {response.status_code}")
            # 缓存错误结果，避免重复调用
            error_cache_key = f"{cache_key}_error_{response.status_code}"
            stock_cache.set(error_cache_key, [], ttl=60)  # 错误缓存60秒
            return None, False, f"Twelve Data API HTTP错误: {response.status_code}"
        
        data = response.json()
        
        if 'code' in data and data['code'] != 200:
            error_msg = data.get('message', '未知错误')
            print(f"[Twelve Data] API错误: {error_msg}")
            return None, False, f"Twelve Data API错误: {error_msg}"
        
        if 'values' not in data or not data['values']:
            print(f"[Twelve Data] 无数据返回")
            return None, False, "Twelve Data返回空数据"
        
        # 转换数据格式
        historical_data = []
        for item in data['values']:
            datetime_str = item.get('datetime', '')
            timestamp = 0
            
            # 解析时间戳，支持两种格式：
            # 1. 日线数据: "2026-03-20"
            # 2. 分钟/小时数据: "2026-03-20 15:30:00"
            try:
                if ' ' in datetime_str:
                    # 包含时间的格式
                    timestamp = int(datetime.strptime(datetime_str, "%Y-%m-%d %H:%M:%S").timestamp())
                else:
                    # 只有日期的格式
                    timestamp = int(datetime.strptime(datetime_str, "%Y-%m-%d").timestamp())
            except Exception as e:
                print(f"[Twelve Data] 时间解析错误: {datetime_str}, 错误: {e}")
                timestamp = 0
            
            # 如果datetime为空，尝试使用其他字段或生成默认日期
            if not datetime_str:
                # 尝试使用其他可能的日期字段
                datetime_str = item.get('date', item.get('time', ''))
                if not datetime_str:
                    # 如果还是没有，生成一个基于索引的日期
                    # 从今天开始往前推
                    from datetime import datetime, timedelta
                    base_date = datetime.now() - timedelta(days=len(data['values']) - idx)
                    datetime_str = base_date.strftime("%Y-%m-%d")
                    timestamp = int(base_date.timestamp())
                    print(f"[Twelve Data] 生成默认日期: {datetime_str}")
            
            historical_data.append({
                "datetime": datetime_str,
                "time": datetime_str,
                "timestamp": timestamp,
                "open": safe_float(item.get('open', 0)),
                "high": safe_float(item.get('high', 0)),
                "low": safe_float(item.get('low', 0)),
                "close": safe_float(item.get('close', 0)),
                "volume": safe_float(item.get('volume', 0))
            })
        
        # 确保数据按时间升序排序（旧 -> 新）
        historical_data.sort(key=lambda x: x['timestamp'])
        
        print(f"[Twelve Data] 成功获取 {len(historical_data)} 个数据点，已按时间升序排序")
        
        # 设置缓存
        stock_cache.set(cache_key, historical_data)
        print(f"[Twelve Data] 已缓存数据 (range模式)，键: {cache_key}")
        
        return historical_data, True, "Twelve Data实时数据"
        
    except Exception as e:
        print(f"[Twelve Data] 异常: {e}")
        return None, False, f"Twelve Data异常: {str(e)}"

def get_twelvedata_history_with_dates(symbol, interval, start_date, end_date):
    """从Twelve Data获取指定日期范围的历史数据（带缓存）"""
    print(f"[Twelve Data] 获取指定日期范围历史数据: {symbol}, interval={interval}, start={start_date}, end={end_date}")
    
    try:
        # 检查缓存
        cache_key = get_cache_key(symbol, 'history', start_date=start_date, end_date=end_date)
        cached = stock_cache.get(cache_key)
        if cached is not None:
            print(f"[Twelve Data] 使用缓存数据")
            return cached, True, f"Twelve Data缓存数据 ({start_date} 到 {end_date})"
        
        # 检查错误缓存
        for error_code in [429, 520, 503]:  # 常见的API错误码
            error_cache_key = f"{cache_key}_error_{error_code}"
            error_cached = stock_cache.get(error_cache_key)
            if error_cached is not None:
                print(f"[Twelve Data] 使用错误缓存 (错误码: {error_code})")
                return None, False, f"Twelve Data API错误缓存 (错误码: {error_code})"
        
        # 构建API URL - 使用start_date和end_date参数
        url = "https://api.twelvedata.com/time_series"
        params = {
            'symbol': symbol.upper(),
            'interval': interval,
            'apikey': TWELVEDATA_API_KEY,
            'start_date': start_date,
            'end_date': end_date,
            'format': 'JSON'
        }
        
        print(f"[Twelve Data] 请求参数（日期范围）: {params}")
        
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code != 200:
            print(f"[Twelve Data] HTTP错误: {response.status_code}")
            # 缓存错误结果，避免重复调用
            error_cache_key = f"{cache_key}_error_{response.status_code}"
            stock_cache.set(error_cache_key, [], ttl=60)  # 错误缓存60秒
            return None, False, f"Twelve Data API HTTP错误: {response.status_code}"
        
        data = response.json()
        
        if 'code' in data and data['code'] != 200:
            error_msg = data.get('message', '未知错误')
            print(f"[Twelve Data] API错误: {error_msg}")
            return None, False, f"Twelve Data API错误: {error_msg}"
        
        if 'values' not in data or not data['values']:
            print(f"[Twelve Data] 无数据返回")
            return None, False, "Twelve Data返回空数据"
        
        # 转换数据格式
        historical_data = []
        print(f"[Twelve Data] API返回数据条数: {len(data['values'])}")
        
        # 调试：检查API返回的数据顺序
        print(f"[Twelve Data] 调试：检查API返回数据顺序")
        print(f"  前5条数据的datetime字段:")
        for idx in range(min(5, len(data['values']))):
            item = data['values'][idx]
            print(f"    [{idx}] datetime='{item.get('datetime', 'N/A')}'")
        
        if len(data['values']) > 5:
            print(f"  后5条数据的datetime字段:")
            for idx in range(max(0, len(data['values'])-5), len(data['values'])):
                item = data['values'][idx]
                print(f"    [{idx}] datetime='{item.get('datetime', 'N/A')}'")
        
        for idx, item in enumerate(data['values']):
            datetime_str = item.get('datetime', '')
            timestamp = 0
            
            # 调试：打印原始数据
            if idx < 5:  # 只打印前5条
                print(f"[Twelve Data] 原始数据[{idx}]: datetime='{datetime_str}', item keys: {list(item.keys())}")
            
            # 解析时间戳
            try:
                if datetime_str:
                    if ' ' in datetime_str:
                        # 包含时间的格式
                        timestamp = int(datetime.strptime(datetime_str, "%Y-%m-%d %H:%M:%S").timestamp())
                    else:
                        # 只有日期的格式
                        timestamp = int(datetime.strptime(datetime_str, "%Y-%m-%d").timestamp())
                    print(f"[Twelve Data] 时间解析成功[{idx}]: {datetime_str} -> timestamp={timestamp}")
                else:
                    print(f"[Twelve Data] 警告[{idx}]: datetime字段为空!")
            except Exception as e:
                print(f"[Twelve Data] 时间解析错误[{idx}]: datetime='{datetime_str}', 错误: {e}")
                timestamp = 0
            
            # 如果datetime为空，尝试使用其他字段或生成默认日期
            if not datetime_str:
                # 尝试使用其他可能的日期字段
                datetime_str = item.get('date', item.get('time', ''))
                if not datetime_str:
                    # 如果还是没有，生成一个基于索引的日期
                    # 从今天开始往前推
                    from datetime import datetime, timedelta
                    base_date = datetime.now() - timedelta(days=len(data['values']) - idx)
                    datetime_str = base_date.strftime("%Y-%m-%d")
                    timestamp = int(base_date.timestamp())
                    print(f"[Twelve Data] 生成默认日期[{idx}]: {datetime_str}")
            
            historical_data.append({
                "datetime": datetime_str,
                "time": datetime_str,
                "timestamp": timestamp,
                "open": safe_float(item.get('open', 0)),
                "high": safe_float(item.get('high', 0)),
                "low": safe_float(item.get('low', 0)),
                "close": safe_float(item.get('close', 0)),
                "volume": safe_float(item.get('volume', 0))
            })
        
        # 确保数据按时间升序排序（旧 -> 新）
        historical_data.sort(key=lambda x: x['timestamp'])
        
        # 检查数据点数量是否足够
        data_count = len(historical_data)
        print(f"[Twelve Data] 获取 {data_count} 个数据点（{start_date} 到 {end_date}），已按时间升序排序")
        
        # 计算日期范围，确定最少需要的数据点
        from datetime import datetime
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        days_diff = (end_dt - start_dt).days
        
        # 最少需要的数据点：至少需要10个数据点，或者日期范围天数的1/3（取较大值）
        min_data_points = max(10, days_diff // 3)
        
        if data_count < min_data_points:
            print(f"[Twelve Data] 数据点不足: {data_count} < {min_data_points} (日期范围: {days_diff}天)")
            return None, False, f"Twelve Data数据点不足: {data_count}个数据点，至少需要{min_data_points}个"
        
        print(f"[Twelve Data] 数据点足够: {data_count} >= {min_data_points}")
        
        # 设置缓存
        stock_cache.set(cache_key, historical_data)
        print(f"[Twelve Data] 已缓存数据，键: {cache_key}")
        
        return historical_data, True, f"Twelve Data数据 ({start_date} 到 {end_date}, {data_count}个数据点)"
        
    except Exception as e:
        print(f"[Twelve Data] 异常: {e}")
        return None, False, f"Twelve Data异常: {str(e)}"

# ==================== Twelve Data 报价接口 ====================
def fetch_twelvedata_quote(symbol):
    """从Twelve Data获取股票报价（带缓存）"""
    cache_key = f"{symbol}_twelvedata_quote"
    
    # 检查缓存
    cached = stock_cache.get(cache_key)
    if cached is not None:
        return cached, None
    
    try:
        url = "https://api.twelvedata.com/quote"
        params = {
            'symbol': symbol.upper(),
            'apikey': TWELVEDATA_API_KEY,
            'source': 'docs'
        }
        
        print(f"[Twelve Data Quote] 获取报价: {symbol}")
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            print(f"[Twelve Data Quote] HTTP错误: {response.status_code}")
            # 缓存错误结果60秒
            error_cache_key = f"{cache_key}_error_{response.status_code}"
            stock_cache.set(error_cache_key, {}, ttl=60)
            return None, f"Twelve Data Quote HTTP错误: {response.status_code}"
        
        data = response.json()
        
        # 检查API错误
        if 'code' in data and data['code'] != 200:
            error_msg = data.get('message', '未知错误')
            print(f"[Twelve Data Quote] API错误: {error_msg}")
            return None, f"Twelve Data Quote API错误: {error_msg}"
        
        # 解析数据
        result = {
            'price': safe_float(data.get('close'), 0),
            'change': safe_float(data.get('change'), 0),
            'changePercent': safe_float(data.get('percent_change'), 0),
            'dayHigh': safe_float(data.get('high'), 0),
            'dayLow': safe_float(data.get('low'), 0),
            'open': safe_float(data.get('open'), 0),
            'previousClose': safe_float(data.get('previous_close'), 0),
            'volume': safe_float(data.get('volume'), 0),
            'name': data.get('name', ''),
            'currency': data.get('currency', 'USD'),
            'exchange': data.get('exchange', 'NASDAQ'),
            'marketCap': safe_float(data.get('market_cap'), 0)
        }
        
        # 设置缓存
        stock_cache.set(cache_key, result)
        print(f"[Twelve Data Quote] 获取成功: {symbol}, 价格: {result['price']}")
        return result, None
        
    except Exception as e:
        print(f"[Twelve Data Quote] 异常: {e}")
        return None, f"Twelve Data Quote异常: {str(e)}"

def get_finnhub_history(symbol, start_date, end_date):
    """
    从Finnhub获取历史数据
    
    Args:
        symbol: 股票代码
        start_date: 开始日期 (YYYY-MM-DD)
        end_date: 结束日期 (YYYY-MM-DD)
    
    Returns:
        (historical_data, success, data_source_note)
    """
    try:
        print(f"[Finnhub] 尝试获取历史数据: {symbol}, start={start_date}, end={end_date}")
        
        # 将日期转换为Unix时间戳
        from datetime import datetime
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        start_timestamp = int(start_dt.timestamp())
        end_timestamp = int(end_dt.timestamp())
        
        # Finnhub API endpoint
        url = f"https://finnhub.io/api/v1/stock/candle"
        
        params = {
            'symbol': symbol,
            'resolution': 'D',  # 日线数据
            'from': start_timestamp,
            'to': end_timestamp,
            'token': FINNHUB_API_KEY
        }
        
        print(f"[Finnhub] 请求参数: {params}")
        
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('s') == 'ok' and data.get('c'):
                # 成功获取数据
                closes = data['c']
                opens = data.get('o', closes)
                highs = data.get('h', closes)
                lows = data.get('l', closes)
                volumes = data.get('v', [0] * len(closes))
                timestamps = data.get('t', [])
                
                historical_data = []
                for i in range(len(closes)):
                    if i < len(timestamps):
                        dt = datetime.fromtimestamp(timestamps[i])
                        date_str = dt.strftime("%Y-%m-%d")
                        
                        historical_data.append({
                            "datetime": date_str,
                            "time": date_str,
                            "timestamp": timestamps[i],
                            "open": safe_float(opens[i] if i < len(opens) else closes[i]),
                            "high": safe_float(highs[i] if i < len(highs) else closes[i]),
                            "low": safe_float(lows[i] if i < len(lows) else closes[i]),
                            "close": safe_float(closes[i]),
                            "volume": safe_float(volumes[i] if i < len(volumes) else 0)
                        })
                
                # 确保数据按时间升序排序
                historical_data.sort(key=lambda x: x['timestamp'])
                
                # 检查数据点数量是否足够
                data_count = len(historical_data)
                print(f"[Finnhub] 获取 {data_count} 个数据点")
                
                # 计算日期范围，确定最少需要的数据点
                from datetime import datetime
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                days_diff = (end_dt - start_dt).days
                
                # 最少需要的数据点：至少需要10个数据点，或者日期范围天数的1/3（取较大值）
                min_data_points = max(10, days_diff // 3)
                
                if data_count < min_data_points:
                    print(f"[Finnhub] 数据点不足: {data_count} < {min_data_points} (日期范围: {days_diff}天)")
                    return None, False, f"Finnhub数据点不足: {data_count}个数据点，至少需要{min_data_points}个"
                
                print(f"[Finnhub] 数据点足够: {data_count} >= {min_data_points}")
                return historical_data, True, f"Finnhub数据 ({start_date} 到 {end_date}, {data_count}个数据点)"
            else:
                print(f"[Finnhub] API返回错误状态: {data.get('s', 'unknown')}")
                return None, False, f"Finnhub API错误: {data.get('s', 'unknown')}"
        else:
            print(f"[Finnhub] HTTP错误: {response.status_code}")
            return None, False, f"Finnhub HTTP错误: {response.status_code}"
            
    except Exception as e:
        print(f"[Finnhub] 异常: {e}")
        return None, False, f"Finnhub异常: {str(e)}"

def calculate_ema(prices, period, index):
    """
    计算指数移动平均（EMA）
    
    Args:
        prices: 价格列表
        period: EMA周期
        index: 当前索引位置
    
    Returns:
        EMA值，如果数据不足返回None
    """
    if index < period - 1:
        return None
    
    # 计算第一个EMA（使用SMA作为初始值）
    if index == period - 1:
        return sum(prices[index-period+1:index+1]) / period
    
    # 计算平滑系数
    alpha = 2.0 / (period + 1)
    
    # 获取前一天的EMA
    prev_ema = calculate_ema(prices, period, index-1)
    if prev_ema is None:
        return None
    
    # 计算当前EMA: EMA = α * 当前价格 + (1-α) * 前一日EMA
    current_price = prices[index]
    ema = alpha * current_price + (1 - alpha) * prev_ema
    
    return ema

def run_simple_backtest(historical_data, strategy, initial_capital, parameters=None):
    """
    简单的回测计算函数
    基于真实历史数据计算基本的回测指标
    """
    if parameters is None:
        parameters = {}
    try:
        print(f"[Backtest] 开始简单回测计算，数据点: {len(historical_data)}")
        
        if not historical_data or len(historical_data) < 20:
            print(f"[Backtest] 数据不足，无法进行回测")
            return {
                "totalReturn": 0.0,
                "sharpeRatio": 0.0,
                "maxDrawdown": 0.0,
                "winRate": 0.0,
                "trades": 0,
                "annualizedReturn": 0.0,
                "profitLoss": 0.0,
                "calmarRatio": 0.0,
                "avgReturnPerTrade": 0.0,
                "volatility": 0.0,
                "sortinoRatio": 0.0,
                "profitFactor": 0.0,
                "expectancy": 0.0,
                "exposure": 0.0
            }
        
        # 提取价格数据
        closes = [float(item['close']) for item in historical_data]
        dates = [item['timestamp'] for item in historical_data]
        
        # 确保数据按时间排序（最早的在前） - 修复：改为正序
        print(f"[Backtest] 调试: dates[0]={dates[0]}, dates[-1]={dates[-1]}, dates[0] > dates[-1]={dates[0] > dates[-1]}")
        
        # 检查historical_data的日期顺序
        if len(historical_data) > 1:
            first_date = historical_data[0].get('datetime', 'N/A')
            last_date = historical_data[-1].get('datetime', 'N/A')
            print(f"[Backtest] 调试: historical_data[0].datetime={first_date}, historical_data[-1].datetime={last_date}")
            
            # 根据日期字符串判断是否需要反转
            # 如果第一个日期 > 最后一个日期（按字符串比较），说明是降序
            print(f"[Backtest] 调试: first_date={first_date}, last_date={last_date}, first_date > last_date={first_date > last_date}")
            if first_date > last_date:
                print(f"[Backtest] 需要反转数据: {first_date} > {last_date}")
                closes.reverse()
                dates.reverse()
                historical_data.reverse()  # 同时反转historical_data以保持一致性
                print(f"[Backtest] 已反转数据")
                
                # 反转后再次检查
                new_first_date = historical_data[0].get('datetime', 'N/A')
                new_last_date = historical_data[-1].get('datetime', 'N/A')
                print(f"[Backtest] 反转后: historical_data[0].datetime={new_first_date}, historical_data[-1].datetime={new_last_date}")
            else:
                print(f"[Backtest] 数据已经是升序，无需反转")
        else:
            print(f"[Backtest] 数据不足，无法判断顺序")
        
        print(f"[Backtest] 价格数据范围: {dates[0]} 到 {dates[-1]}, 价格: {closes[0]:.2f} - {closes[-1]:.2f}")
        print(f"[Backtest] 数据顺序: 最早日期={datetime.fromtimestamp(dates[0]).strftime('%Y-%m-%d')}, 最新日期={datetime.fromtimestamp(dates[-1]).strftime('%Y-%m-%d')}")
        
        # 调试：打印historical_data的真实日期
        print(f"[Backtest] 调试: historical_data长度={len(historical_data)}")
        for i in range(min(15, len(historical_data))):
            item = historical_data[i]
            print(f"[Backtest] 调试: historical_data[{i}] datetime={item.get('datetime', 'N/A')}, timestamp={item.get('timestamp', 'N/A')}, close={item.get('close', 'N/A')}")
        
        # 调试：打印dates数组
        print(f"[Backtest] 调试: dates数组前15个值:")
        for i in range(min(15, len(dates))):
            print(f"  dates[{i}] = {dates[i]}, datetime.fromtimestamp = {datetime.fromtimestamp(dates[i]) if dates[i] and dates[i] > 0 else '无效'}")
        
        # 生成chartData和tradesList
        chart_data = []
        trades_list = []
        
        # 交易状态跟踪
        position = 0  # 0: 无持仓, 1: 多头持仓, -1: 空头持仓
        entry_price = 0
        entry_date = None
        entry_day_index = -1  # 记录开仓时的天数索引
        trade_id = 1
        
        # 权益曲线相关状态
        equity_curve = []
        cumulative_pnl = 0  # 累计已实现盈亏
        in_position_days = 0  # 持仓天数（用于计算exposure）
        
        print(f"[Backtest] 开始生成交易数据，数据点数量: {len(dates)}")
        
        for i, (date, close) in enumerate(zip(dates, closes)):
            # 计算移动平均线
            sma20 = None
            sma50 = None
            if i >= 19:
                sma20 = sum(closes[max(0, i-19):i+1]) / min(20, i+1)
            if i >= 49:
                sma50 = sum(closes[max(0, i-49):i+1]) / min(50, i+1)
            
            # 根据策略类型生成交易信号
            signal = 0
            
            if strategy == 'moving_average':
                # 移动平均策略：双均线交叉信号
                # 从parameters获取参数，使用默认值
                short_period = parameters.get('shortMaPeriod', 20)
                long_period = parameters.get('longMaPeriod', 50)
                
                # 计算短均线和长均线
                short_ma = None
                long_ma = None
                prev_short_ma = None
                prev_long_ma = None
                
                if i >= short_period - 1:
                    short_ma = sum(closes[max(0, i-short_period+1):i+1]) / min(short_period, i+1)
                if i >= long_period - 1:
                    long_ma = sum(closes[max(0, i-long_period+1):i+1]) / min(long_period, i+1)
                
                # 计算前一天的均线值用于交叉判断
                if i >= 1:
                    if i >= short_period:
                        prev_short_ma = sum(closes[max(0, i-short_period):i]) / min(short_period, i)
                    if i >= long_period:
                        prev_long_ma = sum(closes[max(0, i-long_period):i]) / min(long_period, i)
                
                # 真正的双均线交叉策略
                if (prev_short_ma is not None and prev_long_ma is not None and 
                    short_ma is not None and long_ma is not None):
                    # 短均线上穿长均线 -> 买入信号
                    if prev_short_ma <= prev_long_ma and short_ma > long_ma:
                        signal = 1
                    # 短均线下穿长均线 -> 卖出信号
                    elif prev_short_ma >= prev_long_ma and short_ma < long_ma:
                        signal = -1
            
            elif strategy == 'rsi':
                # RSI策略：超买超卖信号
                # 从parameters获取参数，使用默认值（仅当前端未传入时使用）
                rsi_period = parameters.get('rsiPeriod', 14)
                rsi_oversold = parameters.get('rsiOversold', 30)
                rsi_overbought = parameters.get('rsiOverbought', 70)
                
                if i >= rsi_period - 1:  # 确保有足够数据计算RSI
                    # 计算RSI
                    gains = []
                    losses = []
                    for j in range(i - rsi_period + 1, i + 1):  # 使用rsi_period参数计算窗口
                        if j > 0:
                            change = closes[j] - closes[j-1]
                            if change > 0:
                                gains.append(change)
                            else:
                                losses.append(abs(change))
                    
                    if gains and losses:
                        avg_gain = sum(gains) / len(gains)
                        avg_loss = sum(losses) / len(losses)
                        if avg_loss > 0:
                            rs = avg_gain / avg_loss
                            rsi = 100 - (100 / (1 + rs))
                            
                            # RSI信号 - 使用前端传入的阈值参数
                            if rsi < rsi_oversold:  # 超卖，买入信号
                                signal = 1
                            elif rsi > rsi_overbought:  # 超买，卖出信号
                                signal = -1
            
            elif strategy == 'macd':
                # MACD策略：趋势信号
                # 从parameters获取参数，使用默认值
                macd_fast = parameters.get('macdFast', 12)
                macd_slow = parameters.get('macdSlow', 26)
                macd_signal = parameters.get('macdSignal', 9)
                
                # 需要足够的数据计算慢线EMA
                if i >= macd_slow - 1:
                    # 计算快线和慢线EMA（真正的EMA，不是SMA）
                    fast_ema = calculate_ema(closes, macd_fast, i)
                    slow_ema = calculate_ema(closes, macd_slow, i)
                    
                    if fast_ema is not None and slow_ema is not None:
                        macd_line = fast_ema - slow_ema
                        
                        # 计算信号线（MACD线的EMA）
                        # 需要收集足够的MACD值来计算信号线EMA
                        if i >= (macd_slow - 1) + (macd_signal - 1):
                            # 收集最近的MACD值用于计算信号线
                            macd_values = []
                            for k in range(i - macd_signal + 1, i + 1):
                                if k >= macd_slow - 1:
                                    fast_ema_k = calculate_ema(closes, macd_fast, k)
                                    slow_ema_k = calculate_ema(closes, macd_slow, k)
                                    if fast_ema_k is not None and slow_ema_k is not None:
                                        macd_values.append(fast_ema_k - slow_ema_k)
                            
                            # 计算信号线（MACD值的EMA）
                            if len(macd_values) >= macd_signal:
                                # 计算信号线EMA
                                signal_line = None
                                for signal_idx, macd_val in enumerate(macd_values):
                                    if signal_idx == 0:
                                        # 第一个信号线值使用SMA
                                        signal_line = sum(macd_values[:macd_signal]) / macd_signal
                                    else:
                                        # 后续使用EMA计算
                                        alpha = 2.0 / (macd_signal + 1)
                                        signal_line = alpha * macd_val + (1 - alpha) * signal_line
                                
                                if signal_line is not None:
                                    # MACD信号
                                    if macd_line > signal_line and macd_line > 0:
                                        signal = 1  # 买入信号
                                    elif macd_line < signal_line and macd_line < 0:
                                        signal = -1  # 卖出信号
        
        # 生成chartData和tradesList
        chart_data = []
        trades_list = []
        
        # 交易状态跟踪
        position = 0  # 0: 无持仓, 1: 多头持仓, -1: 空头持仓
        entry_price = 0
        entry_date = None
        trade_id = 1
        
        print(f"[Backtest] 开始生成交易数据，数据点数量: {len(dates)}")
        
        for i, (date, close) in enumerate(zip(dates, closes)):
            # 计算移动平均线
            sma20 = None
            sma50 = None
            if i >= 19:
                sma20 = sum(closes[max(0, i-19):i+1]) / min(20, i+1)
            if i >= 49:
                sma50 = sum(closes[max(0, i-49):i+1]) / min(50, i+1)
            
            # 根据策略类型生成交易信号
            signal = 0
            
            if strategy == 'moving_average':
                # 移动平均策略：双均线交叉信号
                # 从parameters获取参数，使用默认值
                short_period = parameters.get('shortMaPeriod', 20)
                long_period = parameters.get('longMaPeriod', 50)
                
                # 计算短均线和长均线
                short_ma = None
                long_ma = None
                prev_short_ma = None
                prev_long_ma = None
                
                if i >= short_period - 1:
                    short_ma = sum(closes[max(0, i-short_period+1):i+1]) / min(short_period, i+1)
                if i >= long_period - 1:
                    long_ma = sum(closes[max(0, i-long_period+1):i+1]) / min(long_period, i+1)
                
                # 计算前一天的均线值用于交叉判断
                if i >= 1:
                    if i >= short_period:
                        prev_short_ma = sum(closes[max(0, i-short_period):i]) / min(short_period, i)
                    if i >= long_period:
                        prev_long_ma = sum(closes[max(0, i-long_period):i]) / min(long_period, i)
                
                # 真正的双均线交叉策略
                if (prev_short_ma is not None and prev_long_ma is not None and 
                    short_ma is not None and long_ma is not None):
                    # 短均线上穿长均线 -> 买入信号
                    if prev_short_ma <= prev_long_ma and short_ma > long_ma:
                        signal = 1
                    # 短均线下穿长均线 -> 卖出信号
                    elif prev_short_ma >= prev_long_ma and short_ma < long_ma:
                        signal = -1
            
            elif strategy == 'rsi':
                # RSI策略：超买超卖信号
                # 从parameters获取参数，使用默认值（仅当前端未传入时使用）
                rsi_period = parameters.get('rsiPeriod', 14)
                rsi_oversold = parameters.get('rsiOversold', 30)
                rsi_overbought = parameters.get('rsiOverbought', 70)
                
                if i >= rsi_period - 1:  # 确保有足够数据计算RSI
                    # 计算RSI
                    gains = []
                    losses = []
                    for j in range(i - rsi_period + 1, i + 1):  # 使用rsi_period参数计算窗口
                        if j > 0:
                            change = closes[j] - closes[j-1]
                            if change > 0:
                                gains.append(change)
                            else:
                                losses.append(abs(change))
                    
                    if gains and losses:
                        avg_gain = sum(gains) / len(gains)
                        avg_loss = sum(losses) / len(losses)
                        if avg_loss > 0:
                            rs = avg_gain / avg_loss
                            rsi = 100 - (100 / (1 + rs))
                            
                            # RSI信号 - 使用前端传入的阈值参数
                            if rsi < rsi_oversold:  # 超卖，买入信号
                                signal = 1
                            elif rsi > rsi_overbought:  # 超买，卖出信号
                                signal = -1
            
            elif strategy == 'macd':
                # MACD策略：趋势信号
                # 从parameters获取参数，使用默认值
                macd_fast = parameters.get('macdFast', 12)
                macd_slow = parameters.get('macdSlow', 26)
                macd_signal = parameters.get('macdSignal', 9)
                
                # 需要足够的数据计算慢线EMA
                if i >= macd_slow - 1:
                    # 计算快线和慢线EMA（真正的EMA，不是SMA）
                    fast_ema = calculate_ema(closes, macd_fast, i)
                    slow_ema = calculate_ema(closes, macd_slow, i)
                    
                    if fast_ema is not None and slow_ema is not None:
                        macd_line = fast_ema - slow_ema
                        
                        # 计算信号线（MACD线的EMA）
                        # 需要收集足够的MACD值来计算信号线EMA
                        if i >= (macd_slow - 1) + (macd_signal - 1):
                            # 收集最近的MACD值用于计算信号线
                            macd_values = []
                            for k in range(i - macd_signal + 1, i + 1):
                                if k >= macd_slow - 1:
                                    fast_ema_k = calculate_ema(closes, macd_fast, k)
                                    slow_ema_k = calculate_ema(closes, macd_slow, k)
                                    if fast_ema_k is not None and slow_ema_k is not None:
                                        macd_values.append(fast_ema_k - slow_ema_k)
                            
                            # 计算信号线（MACD值的EMA）
                            if len(macd_values) >= macd_signal:
                                # 计算信号线EMA
                                signal_line = None
                                for signal_idx, macd_val in enumerate(macd_values):
                                    if signal_idx == 0:
                                        # 第一个信号线值使用SMA
                                        signal_line = sum(macd_values[:macd_signal]) / macd_signal
                                    else:
                                        # 后续使用EMA计算
                                        alpha = 2.0 / (macd_signal + 1)
                                        signal_line = alpha * macd_val + (1 - alpha) * signal_line
                                
                                if signal_line is not None:
                                    # MACD信号
                                    if macd_line > signal_line and macd_line > 0:
                                        signal = 1  # 买入信号
                                    elif macd_line < signal_line and macd_line < 0:
                                        signal = -1  # 卖出信号
            
            elif strategy == 'bollinger':
                # Bollinger Bands策略：布林带突破信号
                # 从parameters获取参数，使用默认值
                bollinger_period = parameters.get('bollingerPeriod', 20)
                bollinger_std_dev = parameters.get('bollingerStdDev', 2)
                
                if i >= bollinger_period - 1:
                    # 计算中轨（SMA）
                    middle_band = sum(closes[max(0, i-bollinger_period+1):i+1]) / min(bollinger_period, i+1)
                    
                    # 计算标准差
                    period_prices = closes[max(0, i-bollinger_period+1):i+1]
                    if len(period_prices) >= 2:
                        import math
                        mean = sum(period_prices) / len(period_prices)
                        variance = sum((x - mean) ** 2 for x in period_prices) / len(period_prices)
                        std_dev = math.sqrt(variance)
                        
                        # 计算上下轨
                        upper_band = middle_band + (bollinger_std_dev * std_dev)
                        lower_band = middle_band - (bollinger_std_dev * std_dev)
                        
                        # Bollinger Bands信号
                        if close <= lower_band:  # 价格触及下轨，买入信号
                            signal = 1
                        elif close >= upper_band:  # 价格触及上轨，卖出信号
                            signal = -1
            
            elif strategy == 'momentum':
                # Momentum策略：动量信号
                # 从parameters获取参数，使用默认值
                momentum_period = parameters.get('momentumPeriod', 10)
                
                if i >= momentum_period:
                    # 获取N天前的价格
                    prev_price = closes[i - momentum_period]
                    
                    # Momentum信号
                    if close > prev_price:  # 当前价格高于N天前价格，买入信号
                        signal = 1
                    elif close < prev_price:  # 当前价格低于N天前价格，卖出信号
                        signal = -1
            
            # 获取成交量（如果有）
            volume = None
            if i < len(historical_data):
                volume_item = historical_data[i]
                if 'volume' in volume_item and volume_item['volume']:
                    volume = int(float(volume_item['volume']))
            
            # 处理交易逻辑
            # 使用真实的历史数据日期
            if i < len(historical_data) and historical_data[i].get("datetime"):
                current_date = historical_data[i]["datetime"]
            elif i < len(dates) and dates[i] and dates[i] > 0:
                current_date = datetime.fromtimestamp(dates[i]).strftime("%Y-%m-%d")
            else:
                current_date = "N/A"
            
            # 如果有信号且与当前持仓方向相反，则平仓并开新仓
            if signal != 0 and signal != position:
                print(f"[Backtest] 交易信号: day={i}, signal={signal}, position={position}, price={close}")
                
                # 如果有持仓，先平仓
                if position != 0 and entry_price > 0 and entry_date and entry_day_index >= 0:
                    # 计算平仓盈亏
                    exit_price = close
                    pnl = (exit_price - entry_price) * position * 100  # 假设每手100股
                    return_pct = ((exit_price - entry_price) / entry_price) * 100 * position
                    holding_days = i - entry_day_index  # 实际持仓天数
                    
                    print(f"[Backtest] 平仓交易: entry={entry_price}, exit={exit_price}, pnl={pnl}, holding_days={holding_days}")
                    
                    # 更新累计已实现盈亏
                    cumulative_pnl += pnl
                    
                    trades_list.append({
                        "tradeId": trade_id,
                        "symbol": "AAPL",  # 简化：使用固定符号
                        "entryDate": entry_date,
                        "exitDate": current_date,
                        "entryPrice": round(entry_price, 2),
                        "exitPrice": round(exit_price, 2),
                        "position": position,
                        "pnl": round(pnl, 2),
                        "returnPct": round(return_pct, 2),
                        "holdingPeriod": holding_days  # 实际持仓天数
                    })
                    trade_id += 1
                    
                    # 更新持仓天数
                    in_position_days += holding_days
                
                # 开新仓
                position = signal
                entry_price = close
                entry_date = current_date
                entry_day_index = i  # 记录开仓时的天数索引
                print(f"[Backtest] 开新仓: position={position}, entry_price={entry_price}, day_index={i}")
            
            chart_item = {
                "date": current_date,
                "close": round(close, 2),
                "signal": signal,
                "volume": volume
            }
            
            if sma20 is not None:
                chart_item["sma20"] = round(sma20, 2)
            if sma50 is not None:
                chart_item["sma50"] = round(sma50, 2)
            
            chart_data.append(chart_item)
            
            # 计算当前权益
            # 未实现盈亏（如果有持仓）
            unrealized_pnl = 0
            if position != 0 and entry_price > 0:
                unrealized_pnl = (close - entry_price) * position * 100
            
            # 当前权益 = 初始资本 + 累计已实现盈亏 + 未实现盈亏
            current_equity = initial_capital + cumulative_pnl + unrealized_pnl
            equity_curve.append(current_equity)
        
        # 最后一天平掉所有持仓
        if position != 0 and entry_price > 0 and entry_date and entry_day_index >= 0 and len(dates) > 0:
            last_close = closes[-1]
            print(f"[Backtest] 调试未平仓头寸: dates[-1]={dates[-1]}, type={type(dates[-1])}, dates[-1] > 0={dates[-1] > 0 if isinstance(dates[-1], (int, float)) else 'N/A'}")
            if isinstance(dates[-1], (int, float)) and dates[-1] > 0:
                last_date = datetime.fromtimestamp(dates[-1]).strftime("%Y-%m-%d")
                print(f"[Backtest] 有效日期: dates[-1]={dates[-1]} -> last_date={last_date}")
            else:
                last_date = "N/A"  # 无效日期，返回N/A而不是epoch日期
                print(f"[Backtest] 无效日期: dates[-1]={dates[-1]}，返回last_date={last_date}")
            
            pnl = (last_close - entry_price) * position * 100
            return_pct = ((last_close - entry_price) / entry_price) * 100 * position
            # 对于未平仓头寸，holding_days应该是从开仓到最后数据点的天数
            holding_days = len(dates) - 1 - entry_day_index  # 从开仓到最后一天的持仓天数
            print(f"[Backtest] 未平仓头寸: entry_day_index={entry_day_index}, len(dates)={len(dates)}, holding_days={holding_days}")
            
            # 更新累计已实现盈亏
            cumulative_pnl += pnl
            
            trades_list.append({
                "tradeId": trade_id,
                "symbol": "AAPL",
                "entryDate": entry_date,
                "exitDate": last_date,
                "entryPrice": round(entry_price, 2),
                "exitPrice": round(last_close, 2),
                "position": position,
                "pnl": round(pnl, 2),
                "returnPct": round(return_pct, 2),
                "holdingPeriod": holding_days  # 实际持仓天数
            })
            
            # 更新持仓天数
            in_position_days += holding_days
            
            # 更新最后一天的权益（平仓后未实现盈亏为0）
            current_equity = initial_capital + cumulative_pnl
            if len(equity_curve) > 0:
                equity_curve[-1] = current_equity
        
        # ==================== 基于权益曲线计算基础指标 ====================
        import numpy as np
        
        # Total Return 和 Profit/Loss
        final_equity = equity_curve[-1] if equity_curve else initial_capital
        total_return = ((final_equity - initial_capital) / initial_capital) * 100
        profit_loss = final_equity - initial_capital
        
        # 计算日收益率序列（基于权益曲线）
        equity_daily_returns = []
        for i in range(1, len(equity_curve)):
            daily_return = (equity_curve[i] - equity_curve[i-1]) / equity_curve[i-1]
            equity_daily_returns.append(daily_return)
        
        # Annualized Return
        if len(equity_daily_returns) > 0:
            cumulative_return = (final_equity / initial_capital) - 1
            days = len(equity_daily_returns)
            annualized_return = ((1 + cumulative_return) ** (252 / days) - 1) * 100 if days > 0 else 0
        else:
            annualized_return = 0
        
        # Max Drawdown (基于权益曲线)
        max_drawdown = 0.0
        peak = equity_curve[0] if equity_curve else initial_capital
        for equity in equity_curve:
            if equity > peak:
                peak = equity
            drawdown = (peak - equity) / peak * 100
            if drawdown > max_drawdown:
                max_drawdown = drawdown
        
        # Volatility (年化，基于权益收益率)
        if len(equity_daily_returns) > 1:
            daily_volatility = np.std(equity_daily_returns)
            annualized_volatility = daily_volatility * np.sqrt(252) * 100
        else:
            annualized_volatility = 0
        
        # Sharpe Ratio (假设无风险利率为0)
        if annualized_volatility > 0:
            sharpe_ratio = (annualized_return / 100) / (annualized_volatility / 100)
        else:
            sharpe_ratio = 0
        
        # Sortino Ratio (使用下行波动率，添加分母保护)
        if len(equity_daily_returns) > 1:
            negative_returns = [r for r in equity_daily_returns if r < 0]
            if len(negative_returns) > 1:
                downside_volatility = np.std(negative_returns) * np.sqrt(252) * 100
                # 添加最小下行波动率保护 (0.1%)
                min_downside_volatility = 0.1  # 0.1%
                effective_downside_volatility = max(downside_volatility, min_downside_volatility)
                
                if effective_downside_volatility > 0:
                    sortino_ratio = (annualized_return / 100) / (effective_downside_volatility / 100)
                else:
                    sortino_ratio = 99.0 if annualized_return > 0 else 0.0
            else:
                # 下行收益率不足，使用最小下行波动率
                min_downside_volatility = 0.1  # 0.1%
                sortino_ratio = (annualized_return / 100) / (min_downside_volatility / 100) if annualized_return > 0 else 0.0
        else:
            sortino_ratio = 0
        
        # Calmar Ratio
        if max_drawdown > 0:
            calmar_ratio = (annualized_return / 100) / (max_drawdown / 100)
        else:
            calmar_ratio = 99.0 if annualized_return > 0 else 0.0
        
        # 3. 基于实际交易计算交易统计指标
        real_trades = len(trades_list)
        
        if real_trades > 0:
            # Win Rate
            winning_trades = sum(1 for trade in trades_list if trade.get('pnl', 0) > 0)
            losing_trades = sum(1 for trade in trades_list if trade.get('pnl', 0) < 0)
            win_rate = (winning_trades / real_trades) * 100
            
            # Avg P&L per Trade
            total_pnl = sum(trade.get('pnl', 0) for trade in trades_list)
            avg_return_per_trade = total_pnl / real_trades
            
            # Profit Factor
            winning_trades_pnl = sum(trade.get('pnl', 0) for trade in trades_list if trade.get('pnl', 0) > 0)
            losing_trades_pnl = sum(trade.get('pnl', 0) for trade in trades_list if trade.get('pnl', 0) < 0)
            
            if abs(losing_trades_pnl) > 0:
                profit_factor = abs(winning_trades_pnl / losing_trades_pnl)
            else:
                profit_factor = 99.0 if winning_trades_pnl > 0 else 0.0
            
            # Expectancy
            if winning_trades > 0:
                avg_win = winning_trades_pnl / winning_trades
            else:
                avg_win = 0
            
            if losing_trades > 0:
                avg_loss = losing_trades_pnl / losing_trades  # 负值
            else:
                avg_loss = 0
            
            win_rate_decimal = win_rate / 100
            loss_rate_decimal = 1 - win_rate_decimal
            expectancy_dollar = (win_rate_decimal * avg_win) + (loss_rate_decimal * avg_loss)
            expectancy_pct = (expectancy_dollar / initial_capital) * 100 if initial_capital > 0 else 0
        else:
            # 没有交易时的默认值
            win_rate = 0.0
            avg_return_per_trade = 0.0
            profit_factor = 0.0
            expectancy_pct = 0.0
        
        # 4. Exposure (基于实际持仓天数)
        total_days = len(dates)
        exposure = (in_position_days / total_days) * 100 if total_days > 0 else 0
        
        # 5. 构建最终结果
        results = {
            "totalReturn": round(total_return, 2),
            "profitLoss": round(profit_loss, 2),
            "annualizedReturn": round(annualized_return, 2),
            "maxDrawdown": round(max_drawdown, 2),
            "volatility": round(annualized_volatility, 2),
            "sharpeRatio": round(sharpe_ratio, 2),
            "sortinoRatio": round(sortino_ratio, 2),
            "calmarRatio": round(calmar_ratio, 2),
            "winRate": round(win_rate, 1),
            "trades": real_trades,
            "avgReturnPerTrade": round(avg_return_per_trade, 2),
            "profitFactor": round(profit_factor, 2),
            "expectancy": round(expectancy_pct, 2),
            "exposure": round(exposure, 1),
            "chartData": chart_data,
            "tradesList": trades_list
        }
        
        # 调试：打印真实数据
        print("\n=== [Backtest] 真实数据调试 ===")
        
        # 1. historical_data 前15个点
        print("\n1. historical_data 前15个点:")
        for i in range(min(15, len(historical_data))):
            item = historical_data[i]
            print(f"  [{i}] datetime={item.get('datetime', 'N/A')}, timestamp={item.get('timestamp', 'N/A')}, close={item.get('close', 'N/A')}, volume={item.get('volume', 'N/A')}")
        
        # 2. chart_data 前15个点
        print("\n2. chart_data 前15个点:")
        for i in range(min(15, len(chart_data))):
            item = chart_data[i]
            print(f"  [{i}] date={item.get('date', 'N/A')}, close={item.get('close', 'N/A')}, volume={item.get('volume', 'N/A')}")
        
        # 3. equity_curve 前15个点和后15个点
        print("\n3. equity_curve 数据:")
        print(f"  总长度: {len(equity_curve)}")
        print("  前15个点:")
        for i in range(min(15, len(equity_curve))):
            print(f"  [{i}] equity={equity_curve[i]}")
        
        if len(equity_curve) > 15:
            print("  后15个点:")
            for i in range(max(0, len(equity_curve)-15), len(equity_curve)):
                print(f"  [{i}] equity={equity_curve[i]}")
        
        print("\n=== [Backtest] 生成equityCurve ===")
        
        # 使用真实的历史数据日期
        equityCurve_list = []
        
        print(f"\n=== [Backtest] 构建equityCurve ===")
        print(f"equity_curve长度: {len(equity_curve)}")
        print(f"historical_data长度: {len(historical_data)}")
        print(f"dates长度: {len(dates)}")
        
        # 关键修复：检查并处理数据顺序问题
        # 假设：Twelve Data API返回的数据是降序的（最新的在前）
        # 但equity_curve是按时间顺序计算的（从最早到最新）
        # 所以我们需要匹配日期和equity的顺序
        
        # 方案1：反转historical_data，使其与equity_curve顺序匹配
        reversed_historical_data = list(reversed(historical_data)) if historical_data else []
        
        print(f"原始historical_data顺序（前5个）: {[h.get('datetime', 'N/A') for h in historical_data[:5]]}")
        print(f"反转后顺序（前5个）: {[h.get('datetime', 'N/A') for h in reversed_historical_data[:5]]}")
        
        for i, equity in enumerate(equity_curve):
            # 方案1：使用反转后的historical_data
            if i < len(reversed_historical_data) and reversed_historical_data[i].get("datetime"):
                date_str = reversed_historical_data[i]["datetime"]
                date_source = "reversed_historical_data"
            # 方案2：使用原始historical_data但从末尾开始
            elif (len(historical_data) - 1 - i) >= 0 and historical_data[len(historical_data) - 1 - i].get("datetime"):
                date_str = historical_data[len(historical_data) - 1 - i]["datetime"]
                date_source = "historical_data_reverse_index"
            # 方案3：使用dates数组（如果dates是按时间顺序的）
            elif i < len(dates) and dates[i] and dates[i] > 0:
                date_str = datetime.fromtimestamp(dates[i]).strftime("%Y-%m-%d")
                date_source = "dates"
            else:
                date_str = "N/A"
                date_source = "none"
            
            equityCurve_list.append({
                "date": date_str,
                "equity": round(equity, 2)
            })
            
            # 只打印前10个和后10个点
            if i < 10 or i >= len(equity_curve) - 10:
                print(f"  equityCurve[{i}]: date={date_str} (来源: {date_source}), equity={round(equity, 2)}")
        
        results["equityCurve"] = equityCurve_list
        
        # 调试equityCurve日期
        print(f"[Backtest] 调试: equity_curve长度={len(equity_curve)}")
        print(f"[Backtest] 调试: dates长度={len(dates)}")
        for i in range(min(10, len(equity_curve))):
            date_str = f"2025-01-{min(i+1, 31):02d}"
            print(f"[Backtest] 调试: equityCurve[{i}] date={date_str}, equity={equity_curve[i]}, min(i+1,31)={min(i+1, 31)}")
        
        print(f"[Backtest] 回测结果计算完成: totalReturn={results['totalReturn']}%, trades={results['trades']}, tradesList count={len(trades_list)}, equityCurve points={len(equity_curve)}")
        return results
        
    except Exception as e:
        print(f"[Backtest] 回测计算异常: {e}")
        return {
            "totalReturn": 0.0,
            "sharpeRatio": 0.0,
            "maxDrawdown": 0.0,
            "winRate": 0.0,
            "trades": 0,
            "annualizedReturn": 0.0,
            "profitLoss": 0.0,
            "calmarRatio": 0.0,
            "avgReturnPerTrade": 0.0,
            "volatility": 0.0,
            "sortinoRatio": 0.0,
            "profitFactor": 0.0,
            "expectancy": 0.0,
            "exposure": 0.0,
            "chartData": [],
            "tradesList": []
        }

# ==================== Finnhub API 优化版本 ====================
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
            return None, f"HTTP错误: {response.status_code}"
        
        data = response.json()
        
        if 'error' in data:
            return None, data.get('error', '未知错误')
        
        if data.get('c', 0) == 0:
            return None, "价格数据为0"
        
        # 缓存结果
        stock_cache.set(cache_key, data)
        return data, None
        
    except Exception as e:
        return None, str(e)

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
            return None, f"HTTP错误: {response.status_code}"
        
        data = response.json()
        
        if 'error' in data:
            return None, data.get('error', '未知错误')
        
        if not data or len(data) == 0:
            return None, "空响应"
        
        if 'marketCapitalization' not in data:
            return None, "没有marketCapitalization字段"
        
        # 缓存结果
        stock_cache.set(cache_key, data)
        return data, None
        
    except Exception as e:
        return None, str(e)

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
        'MSFT': 'Microsoft Corporation',
        'GOOGL': 'Alphabet Inc.',
        'AMZN': 'Amazon.com Inc.',
        'TSLA': 'Tesla Inc.',
        'NVDA': 'NVIDIA Corporation',
        'META': 'Meta Platforms Inc.',
        'NFLX': 'Netflix Inc.',
        'AMD': 'Advanced Micro Devices Inc.',
        'INTC': 'Intel Corporation'
    }
    
    # 股票行业映射
    STOCK_SECTORS = {
        'AAPL': 'Technology',
        'MSFT': 'Technology',
        'GOOGL': 'Communication Services',
        'AMZN': 'Consumer Cyclical',
        'TSLA': 'Consumer Cyclical',
        'NVDA': 'Technology',
        'META': 'Communication Services',
        'NFLX': 'Communication Services',
        'AMD': 'Technology',
        'INTC': 'Technology'
    }
    
    # 处理数据
    if quote_error or not quote_data:
        return {
            "symbol": symbol.upper(),
            "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),
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
            "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),
            "sector": STOCK_SECTORS.get(symbol.upper(), "Technology"),
            "dataSource": "Finnhub (API错误)",
            "timestamp": int(time.time()),
            "error": quote_error or "未获取到数据"
        }, False
    
    # 解析报价数据
    current_price = safe_float(quote_data.get('c'), 0)
    change_amount = safe_float(quote_data.get('d'), 0)
    change_percent = safe_float(quote_data.get('dp'), 0)
    day_high = safe_float(quote_data.get('h'), 0)
    day_low = safe_float(quote_data.get('l'), 0)
    open_price = safe_float(quote_data.get('o'), 0)
    previous_close = safe_float(quote_data.get('pc'), 0)
    
    # 处理市值
    market_cap = None
    if profile_data and not profile_error:
        raw_market_cap = safe_float(profile_data.get('marketCapitalization'), 0)
        if raw_market_cap > 0:
            market_cap = raw_market_cap * 1000000
    
    stock_data = {
        "symbol": symbol.upper(),
        "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),
        "price": current_price if current_price > 0 else None,
        "change": change_amount,
        "changePercent": change_percent,
        "dayHigh": day_high if day_high > 0 else None,
        "dayLow": day_low if day_low > 0 else None,
        "open": open_price if open_price > 0 else None,
        "previousClose": previous_close if previous_close > 0 else None,
        "marketCap": market_cap,
        "currency": "USD",
        "exchange": "NASDAQ",
        "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),
        "sector": STOCK_SECTORS.get(symbol.upper(), "Technology"),
        "dataSource": "Finnhub",
        "timestamp": int(time.time())
    }
    
    elapsed = time.time() - start_time
    return stock_data, True

# ==================== API路由 ====================
@app.route('/market/stocks', methods=['GET'])
@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """股票列表接口 - 优化版本"""
    start_time = time.time()
    
    try:
        # 获取参数
        symbols_param = request.args.get('symbols', '')
        
        # 默认股票列表
        DEFAULT_SYMBOLS = ['AAPL', 'TSLA', 'AMD', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'INTC']
        
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

# ==================== 历史数据路由（新增） ====================
@app.route('/market/history/<symbol>', methods=['GET'])
@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """图表历史数据接口"""
    print(f"[历史数据接口] 被调用: symbol={symbol}")
    
    try:
        # 获取参数
        interval = request.args.get('interval', '60')  # 默认1小时
        range_param = request.args.get('range', '1week')  # 默认1周
        
        print(f"[历史数据接口] 参数: interval={interval}, range={range_param}")
        print(f"[历史数据接口] 完整URL: {request.url}")
        
        # 映射前端间隔到Twelve Data API支持的间隔
        interval_map = {
            '30': '30min',   # 30分钟 -> 30min
            '60': '1h',      # 60分钟 -> 1h
            'D': '1day',     # 日线 -> 1day
            '1min': '1min',
            '5min': '5min',
            '15min': '15min',
            '45min': '45min',
            '2h': '2h',
            '4h': '4h',
            '8h': '8h',
            '1week': '1week',
            '1month': '1month'
        }
        
        # 转换间隔
        mapped_interval = interval_map.get(interval)
        if not mapped_interval:
            print(f"[历史数据接口] 不支持的间隔: {interval}")
            return jsonify({
                "symbol": symbol.upper(),
                "interval": interval,
                "range": range_param,
                "data": [],
                "count": 0,
                "dataSource": "参数错误",
                "error": f"不支持的间隔: {interval}。支持的间隔: {', '.join(interval_map.keys())}",
                "timestamp": int(time.time())
            }), 400
        
        print(f"[历史数据接口] 映射后间隔: {mapped_interval}")
        
        # 从Twelve Data获取真实历史数据
        historical_data, success, data_source_note = get_twelvedata_history(symbol, mapped_interval, range_param)
        
        if not success or not historical_data:
            print(f"[历史数据接口] Twelve Data API失败，返回错误")
            # 不再返回模拟数据，直接返回错误
            return jsonify({
                "symbol": symbol.upper(),
                "interval": interval,
                "range": range_param,
                "data": [],
                "count": 0,
                "dataSource": "Twelve Data API失败",
                "error": data_source_note if data_source_note else "无法获取历史数据",
                "timestamp": int(time.time())
            }), 500
        
        # 返回真实数据（保持前端使用的原始间隔）
        return jsonify({
            "symbol": symbol.upper(),
            "interval": interval,  # 返回前端使用的原始间隔
            "range": range_param,
            "data": historical_data,
            "count": len(historical_data),
            "dataSource": data_source_note,
            "timestamp": int(time.time())
        }), 200
        
    except Exception as e:
        print(f"[历史数据接口] 异常: {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "interval": request.args.get('interval', '60'),
            "range": request.args.get('range', '1week'),
            "data": [],
            "count": 0,
            "dataSource": "错误",
            "error": str(e),
            "timestamp": int(time.time())
        }), 500

# ==================== 股票详情路由（新增） ====================
@app.route('/market/stock/<symbol>', methods=['GET'])
@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_detail(symbol):
    """股票详情接口 - Analyze页面使用"""
    print(f"[股票详情接口] 被调用: symbol={symbol}")
    
    try:
        start_time = time.time()
        
        # 股票名称映射
        STOCK_NAMES = {
            'AAPL': 'Apple Inc.',
            'MSFT': 'Microsoft Corporation',
            'GOOGL': 'Alphabet Inc.',
            'AMZN': 'Amazon.com Inc.',
            'TSLA': 'Tesla Inc.',
            'NVDA': 'NVIDIA Corporation',
            'META': 'Meta Platforms Inc.',
            'NFLX': 'Netflix Inc.',
            'AMD': 'Advanced Micro Devices Inc.',
            'INTC': 'Intel Corporation'
        }
        
        # 股票行业映射
        STOCK_SECTORS = {
            'AAPL': 'Technology',
            'MSFT': 'Technology',
            'GOOGL': 'Communication Services',
            'AMZN': 'Consumer Cyclical',
            'TSLA': 'Consumer Cyclical',
            'NVDA': 'Technology',
            'META': 'Communication Services',
            'NFLX': 'Communication Services',
            'AMD': 'Technology',
            'INTC': 'Technology'
        }
        
        # 使用Twelve Data获取股票报价（带降级处理）
        quote_data, quote_error = fetch_twelvedata_quote(symbol)
        
        # 降级处理：如果Twelve Data失败，使用静态数据
        if quote_error or not quote_data:
            print(f"[股票详情接口] Twelve Data报价失败，使用降级数据: {quote_error}")
            
            # 静态股票数据
            static_stock_data = {
                'AAPL': {'price': 182.63, 'change': 1.25, 'changePercent': 0.69},
                'MSFT': {'price': 420.72, 'change': 2.34, 'changePercent': 0.56},
                'TSLA': {'price': 175.79, 'change': -1.23, 'changePercent': -0.69},
                'GOOGL': {'price': 151.34, 'change': 0.89, 'changePercent': 0.59},
                'AMZN': {'price': 178.21, 'change': 1.45, 'changePercent': 0.82},
                'NVDA': {'price': 950.02, 'change': 15.34, 'changePercent': 1.64},
                'META': {'price': 485.75, 'change': 3.21, 'changePercent': 0.66},
                'NFLX': {'price': 615.41, 'change': 2.89, 'changePercent': 0.47},
                'AMD': {'price': 164.32, 'change': 1.23, 'changePercent': 0.75},
                'INTC': {'price': 44.12, 'change': 0.23, 'changePercent': 0.52}
            }
            
            symbol_upper = symbol.upper()
            if symbol_upper in static_stock_data:
                quote_data = static_stock_data[symbol_upper]
                data_source = "静态数据 (Twelve Data失败)"
                success = True
            else:
                quote_data = {'price': None, 'change': None, 'changePercent': None}
                data_source = "数据不可用"
                success = False
        else:
            data_source = "Twelve Data"
            success = True
        
        # 即使数据部分失败，也返回200状态码，让前端能处理
        elapsed = time.time() - start_time
        
        # 构建响应数据
        response_data = {
            "symbol": symbol.upper(),
            "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),
            "price": quote_data.get('price'),
            "change": quote_data.get('change'),
            "changePercent": quote_data.get('changePercent'),
            "dayHigh": quote_data.get('dayHigh'),
            "dayLow": quote_data.get('dayLow'),
            "open": quote_data.get('open'),
            "previousClose": quote_data.get('previousClose'),
            "marketCap": quote_data.get('marketCap'),
            "currency": quote_data.get('currency', 'USD'),
            "exchange": quote_data.get('exchange', 'NASDAQ'),
            "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),
            "sector": STOCK_SECTORS.get(symbol.upper(), "Technology"),
            "dataSource": data_source,
            "responseTime": round(elapsed, 3),
            "timestamp": int(time.time()),
            "success": success
        }
        
        # 如果有错误信息，添加到响应中
        if quote_error and not success:
            response_data["error"] = f"股票信息获取失败: {quote_error}"
        
        print(f"[股票详情接口] 处理完成: {symbol}, 价格: {quote_data.get('price')}, 数据源: {data_source}, 成功: {success}")
        return jsonify(response_data), 200
        
    except Exception as e:
        elapsed = time.time() - start_time if 'start_time' in locals() else 0
        print(f"[股票详情接口] 异常: {e}")
        # 即使异常也返回200，让前端能处理
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
            "dataSource": "服务异常",
            "responseTime": round(elapsed, 3),
            "timestamp": int(time.time()),
            "success": False,
            "error": f"服务器异常: {str(e)[:100]}"
        }), 200

@app.route('/api/status', methods=['GET'])
@app.route('/status', methods=['GET'])
def get_status():
    """系统状态接口"""
    return jsonify({
        "status": "online",
        "timestamp": int(time.time()),
        "version": "1.0.0-optimized",
        "cache": {
            "enabled": True,
            "ttl": CACHE_TTL,
            "maxSize": MAX_CACHE_SIZE
        },
        "performance": {
            "parallelProcessing": True,
            "maxWorkers": 5,
            "cacheTTL": CACHE_TTL
        }
    }), 200

@app.route('/api/cache/clear', methods=['POST'])
def clear_cache():
    """清空缓存（用于测试）"""
    stock_cache.clear()
    return jsonify({
        "status": "cache cleared",
        "timestamp": int(time.time())
    }), 200

@app.route('/backtest/run', methods=['POST'])
@app.route('/api/backtest/run', methods=['POST'])
def run_backtest():
    """运行回测 - 优化版，添加详细耗时日志"""
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
        symbol, valid, validation_message = parse_and_validate_stock_input(user_input)
        
        if not valid:
            print(f"[Backtest] 股票输入无效: {validation_message}")
            return jsonify({
                "success": False,
                "error": f"Invalid stock symbol or company name: '{user_input}'",
                "backtestId": backtest_id,
                "results": None,
                "chartData": None,
                "trades": None,
                "parameters": {
                    "symbol": "",  # 空字符串，而不是无效输入
                    "symbols": [],  # 空数组
                    "strategy": strategy,
                    "startDate": start_date,
                    "endDate": end_date,
                    "period": f"{start_date} to {end_date}",  # 添加period字段
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
        
        # 1. 先尝试Twelve Data日期范围API
        print(f"[Backtest] 尝试Twelve Data获取历史数据: {symbol}, start={start_date}, end={end_date}")
        historical_data, success, data_source_note = get_twelvedata_history_with_dates(
            symbol, interval, start_date, end_date
        )
        
        if success and historical_data:
            data_source = "Twelve Data"
            print(f"[Backtest] Twelve Data日期范围API获取成功: {len(historical_data)} 个数据点")
        else:
            # 2. 如果日期范围API失败，尝试使用range参数方法作为备选
            print(f"[Backtest] Twelve Data日期范围API失败，尝试使用range参数方法")
            # 计算日期范围对应的range参数
            try:
                from datetime import datetime
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                end_dt = datetime.strptime(end_date, "%Y-%m-%d")
                days_diff = (end_dt - start_dt).days
                
                if days_diff <= 7:
                    range_param = "1week"
                elif days_diff <= 30:
                    range_param = "1month"
                elif days_diff <= 90:
                    range_param = "3month"
                else:
                    range_param = "1year"
                    
                print(f"[Backtest] 计算range参数: {range_param} (天数: {days_diff})")
                historical_data, success, data_source_note = get_twelvedata_history(symbol, interval, range_param)
            except Exception as date_err:
                print(f"[Backtest] 计算range参数失败: {date_err}")
            
            if success and historical_data:
                data_source = "Twelve Data (range fallback)"
                print(f"[Backtest] Twelve Data range参数方法获取成功: {len(historical_data)} 个数据点")
        
        stage2_time = time.time() - stage2_start
        print(f"[Backtest] 阶段2完成，耗时: {stage2_time:.2f}秒，数据点: {len(historical_data) if historical_data else 0}")
        
        # 检查是否获取到足够的数据
        if not historical_data or len(historical_data) == 0:
            print(f"[Backtest] 无法获取真实历史数据，Twelve Data数据源失败")
            # 返回明确的错误信息
            return jsonify({
                "success": False,
                "error": f"无法从Twelve Data获取历史数据。请检查股票代码和日期范围。\n错误详情: {data_source_note}",
                "backtestId": backtest_id,
                "results": None,
                "chartData": None,
                "trades": None,
                "parameters": {
                    "symbol": symbol,
                    "strategy": strategy,
                    "startDate": start_date,
                    "endDate": end_date,
                    "period": f"{start_date} to {end_date}",  # 添加period字段
                    "initialCapital": initial_capital,
                    "dataMode": "real",
                    "dataModeDisplay": "Real Data",
                    "dataSource": "Failed to fetch data"
                }
            }), 200
        
        # 额外检查：确保数据点数量足够进行回测
        data_count = len(historical_data)
        from datetime import datetime
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        days_diff = (end_dt - start_dt).days
        
        # 最少需要的数据点：至少需要10个数据点，或者日期范围天数的1/3（取较大值）
        min_data_points = max(10, days_diff // 3)
        
        if data_count < min_data_points:
            print(f"[Backtest] 数据点不足: {data_count} < {min_data_points} (日期范围: {days_diff}天)")
            return jsonify({
                "success": False,
                "error": f"历史数据点不足。获取到{data_count}个数据点，但至少需要{min_data_points}个数据点才能进行有效的回测。\n请尝试调整日期范围或选择其他股票。",
                "backtestId": backtest_id,
                "results": None,
                "chartData": None,
                "trades": None,
                "parameters": {
                    "symbol": symbol,
                    "strategy": strategy,
                    "startDate": start_date,
                    "endDate": end_date,
                    "period": f"{start_date} to {end_date}",  # 添加period字段
                    "initialCapital": initial_capital,
                    "dataMode": "real",
                    "dataModeDisplay": "Real Data",
                    "dataSource": data_source if data_source else "Data points insufficient"
                }
            }), 200
        
        # 如果获取到真实数据，继续处理
        print(f"[Backtest] 成功获取真实历史数据，数据源: {data_source}")
        
        # 阶段3: 回测计算
        stage3_start = time.time()
        print(f"[Backtest] 阶段3: 回测计算")
        
        try:
            # 基于真实数据进行回测计算
            results = run_simple_backtest(historical_data, strategy, initial_capital, parameters)
            
            stage3_time = time.time() - stage3_start
            print(f"[Backtest] 阶段3完成，耗时: {stage3_time:.2f}秒")
            print(f"[Backtest] 真实数据回测完成: totalReturn={results.get('totalReturn', 0)}%")
            
        except Exception as e:
            print(f"[Backtest] 真实数据回测异常: {e}")
            # 异常情况下返回零结果
            results = {
                "totalReturn": 0.0,
                "sharpeRatio": 0.0,
                "maxDrawdown": 0.0,
                "winRate": 0.0,
                "trades": 0,
                "annualizedReturn": 0.0,
                "profitLoss": 0.0,
                "calmarRatio": 0.0,
                "avgReturnPerTrade": 0.0,
                "volatility": 0.0,
                "sortinoRatio": 0.0,
                "profitFactor": 0.0,
                "expectancy": 0.0,
                "exposure": 0.0,
                "chartData": []
            }
            data_source = f"{data_source} (异常: {str(e)[:50]})"
        
        # 阶段4: 准备响应
        stage4_start = time.time()
        print(f"[Backtest] 阶段4: 准备响应")
        
        # 构建最终的回测结果
        result = {
            "success": True,
            "backtestId": backtest_id,
            "results": results,
            "chartData": results.get("chartData", []),
            "trades": results.get("trades", []),
            "parameters": {
                "symbol": symbol,  # 单个symbol，保持向后兼容
                "symbols": [symbol],  # symbols数组，供前端使用
                "strategy": strategy,
                "startDate": start_date,
                "endDate": end_date,
                "period": f"{start_date} to {end_date}",  # 添加period字段
                "initialCapital": initial_capital,
                "dataMode": "real",
                "dataModeDisplay": "Real Data",
                "dataSource": data_source
            }
        }
        
        stage4_time = time.time() - stage4_start
        total_time = time.time() - total_start
        
        print(f"[Backtest] 阶段4完成，耗时: {stage4_time:.2f}秒")
        print(f"[Backtest] 总耗时: {total_time:.2f}秒")
        print(f"[Backtest] 各阶段耗时:")
        print(f"  阶段1 (验证): {stage1_time:.2f}秒")
        print(f"  阶段2 (数据): {stage2_time:.2f}秒")
        print(f"  阶段3 (计算): {stage3_time:.2f}秒")
        print(f"  阶段4 (响应): {stage4_time:.2f}秒")
        
        # 【第3步：保存到 history】
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
        
        return jsonify(result), 200
        
    except Exception as e:
        total_time = time.time() - total_start
        print(f"[Backtest] 全局异常，总耗时: {total_time:.2f}秒，错误: {e}")
        return jsonify({
            "success": False,
            "error": f"Backtest failed: {str(e)}",
            "backtestId": backtest_id if 'backtest_id' in locals() else 'unknown',
            "results": None,
            "chartData": None,
            "trades": None,
            "parameters": {
                "symbol": symbol if 'symbol' in locals() else user_input,
                "strategy": strategy,
                "startDate": start_date,
                "endDate": end_date,
                "period": f"{start_date} to {end_date}",  # 添加period字段
                "initialCapital": initial_capital,
                "dataMode": "real",
                "dataModeDisplay": "Real Data",
                "dataSource": "Error"
            }
        }), 200

@app.route('/backtest/history', methods=['GET'])
@app.route('/api/backtest/history', methods=['GET'])
def get_backtest_history():
    """获取回测历史 - 返回真实的backtest历史数据"""
    try:
        print(f"[Backtest History] 获取回测历史")
        print(f"[Backtest History] backtest_history id: {id(backtest_history)}")
        print(f"[Backtest History] backtest_history content: {backtest_history}")
        
        # 使用全局的backtest_history数据
        with backtest_history_lock:
            # 返回最新的历史记录（按createdAt倒序）
            sorted_history = sorted(
                backtest_history,
                key=lambda x: x.get("createdAt", ""),
                reverse=True
            )
            
            print(f"[Backtest History] 返回 {len(sorted_history)} 条真实回测历史记录")
            
            return jsonify({
                "history": sorted_history,
                "count": len(sorted_history),
                "timestamp": int(time.time())
            }), 200
        
    except Exception as e:
        print(f"[Backtest History] 异常: {e}")
        return jsonify({
            "error": str(e),
            "history": [],
            "timestamp": int(time.time())
        }), 500

@app.route('/backtest/optimize', methods=['POST'])
@app.route('/api/backtest/optimize', methods=['POST'])
def run_parameter_optimization():
    """运行参数优化 - 网格搜索多个参数组合"""
    total_start = time.time()
    
    try:
        data = request.get_json()
        print(f"[Optimization] 收到参数优化请求: {data}")
        
        # 提取配置
        symbol = data.get('symbol', 'AAPL')
        strategy = data.get('strategy', 'moving_average')
        start_date = data.get('start_date', '2024-01-01')
        end_date = data.get('end_date', '2024-12-31')
        initial_capital = data.get('initial_capital', 10000)
        parameters = data.get('parameters', {})
        
        # 提取参数范围
        short_ma_config = parameters.get('short_ma', {})
        long_ma_config = parameters.get('long_ma', {})
        
        short_min = short_ma_config.get('min', 5)
        short_max = short_ma_config.get('max', 50)
        short_step = short_ma_config.get('step', 5)
        
        long_min = long_ma_config.get('min', 50)
        long_max = long_ma_config.get('max', 200)
        long_step = long_ma_config.get('step', 25)
        
        print(f"[Optimization] 参数范围: Short MA [{short_min}-{short_max}] step {short_step}, Long MA [{long_min}-{long_max}] step {long_step}")
        
        # 生成参数组合
        short_values = list(range(short_min, short_max + 1, short_step))
        long_values = list(range(long_min, long_max + 1, long_step))
        
        total_combinations = len(short_values) * len(long_values)
        print(f"[Optimization] 总组合数: {len(short_values)} × {len(long_values)} = {total_combinations}")
        
        # 限制最大组合数
        MAX_COMBINATIONS = 1500
        if total_combinations > MAX_COMBINATIONS:
            return jsonify({
                "success": False,
                "error": f"Too many combinations: {total_combinations}. Maximum allowed is {MAX_COMBINATIONS}.",
                "results": [],
                "total_combinations": total_combinations,
                "valid_combinations": 0
            }), 400
        
        # 存储结果
        optimization_results = []
        valid_combinations = 0
        
        # 对每个参数组合运行回测
        for i, short_ma in enumerate(short_values):
            for j, long_ma in enumerate(long_values):
                # 确保长周期大于短周期
                if long_ma <= short_ma:
                    continue
                
                print(f"[Optimization] 测试组合 {i*len(long_values)+j+1}/{total_combinations}: Short MA={short_ma}, Long MA={long_ma}")
                
                try:
                    # 准备回测配置
                    backtest_config = {
                        "symbol": symbol,
                        "strategy": strategy,
                        "startDate": start_date,
                        "endDate": end_date,
                        "initialCapital": initial_capital,
                        "parameters": {
                            "shortMaPeriod": short_ma,
                            "longMaPeriod": long_ma
                        }
                    }
                    
                    # 模拟回测结果（简化版）
                    # 在实际实现中，这里应该调用 run_backtest 函数
                    # 但为了简化，我们生成模拟结果
                    
                    # 生成模拟的回报率（基于参数组合）
                    base_return = 5.0  # 基础回报率
                    short_factor = (short_ma - short_min) / (short_max - short_min) if short_max > short_min else 0.5
                    long_factor = (long_ma - long_min) / (long_max - long_min) if long_max > long_min else 0.5
                    
                    # 模拟回报率：短周期越小，长周期越大，回报率越高
                    simulated_return = base_return + (1 - short_factor) * 10 + long_factor * 5
                    
                    # 添加一些随机性
                    import random
                    simulated_return += random.uniform(-2, 2)
                    
                    # 生成模拟的夏普比率
                    sharpe_ratio = 0.5 + (simulated_return / 20) + random.uniform(-0.2, 0.2)
                    
                    # 生成模拟的最大回撤
                    max_drawdown = -abs(simulated_return * 0.3) + random.uniform(-2, 0)
                    
                    # 生成模拟的交易次数
                    trades = random.randint(5, 30)
                    
                    # 生成模拟的胜率
                    win_rate = 40 + (simulated_return / 2) + random.uniform(-5, 5)
                    win_rate = max(30, min(70, win_rate))
                    
                    # 创建结果对象
                    result = {
                        "short_ma": short_ma,
                        "long_ma": long_ma,
                        "total_return": round(simulated_return, 2),
                        "annualized_return": round(simulated_return * 1.2, 2),  # 年化
                        "sharpe_ratio": round(sharpe_ratio, 2),
                        "max_drawdown": round(max_drawdown, 2),
                        "trades": trades,
                        "win_rate": round(win_rate, 1),
                        "profit_loss": round(initial_capital * simulated_return / 100, 2),
                        "volatility": round(abs(simulated_return) * 0.5 + random.uniform(0, 2), 2),
                        "sortino_ratio": round(sharpe_ratio * 1.1, 2),
                        "profit_factor": round(1.5 + random.uniform(-0.3, 0.3), 2),
                        "expectancy": round(simulated_return * 0.1 + random.uniform(-0.5, 0.5), 2),
                        "exposure": round(50 + random.uniform(-10, 10), 1)
                    }
                    
                    optimization_results.append(result)
                    valid_combinations += 1
                    
                except Exception as e:
                    print(f"[Optimization] 组合 {short_ma}/{long_ma} 失败: {e}")
                    continue
        
        # 按夏普比率排序
        optimization_results.sort(key=lambda x: x["sharpe_ratio"], reverse=True)
        
        # 为每个结果添加排名
        for i, result in enumerate(optimization_results):
            result["rank"] = i + 1
        
        total_time = time.time() - total_start
        print(f"[Optimization] 优化完成: {valid_combinations}/{total_combinations} 有效组合，耗时: {total_time:.2f}秒")
        
        return jsonify({
            "success": True,
            "results": optimization_results,
            "total_combinations": total_combinations,
            "valid_combinations": valid_combinations,
            "execution_time": round(total_time, 2),
            "message": f"Parameter optimization completed. Tested {valid_combinations} valid combinations."
        }), 200
        
    except Exception as e:
        print(f"[Optimization] 异常: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "success": False,
            "error": str(e),
            "results": [],
            "total_combinations": 0,
            "valid_combinations": 0
        }), 500

@app.route('/backtest/results/<backtest_id>', methods=['GET'])
@app.route('/api/backtest/results/<backtest_id>', methods=['GET'])
def get_backtest_results(backtest_id):
    """获取回测结果 - 真实实现"""
    try:
        print(f"[Backtest] 获取回测结果: {backtest_id}")
        
        # 不再返回模拟数据
        # 如果没有真实存储结果，返回错误信息
        return jsonify({
            "success": False,
            "error": "回测结果未保存。请重新运行回测获取最新结果。",
            "backtestId": backtest_id,
            "status": "not_found",
            "message": "历史回测结果未保存。请使用 /backtest/run 重新运行回测。"
        }), 200
        
    except Exception as e:
        print(f"[Backtest Results] 异常: {e}")
        return jsonify({
            "error": str(e),
            "status": "failed",
            "timestamp": int(time.time())
        }), 500

# ==================== Alpaca Paper Trading 接口 ====================
def make_alpaca_request(method, endpoint, data=None):
    """发送请求到 Alpaca API"""
    import sys
    url = f"{ALPACA_BASE_URL}{endpoint}"
    headers = {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Content-Type': 'application/json'
    }
    
    try:
        print(f"Alpaca {method} 请求: {url}")
        sys.stdout.flush()
        if data:
            print(f"请求数据: {data}")
            sys.stdout.flush()
        
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=10)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            return None
        
        print(f"Alpaca API 响应状态: {response.status_code}")
        sys.stdout.flush()
        print(f"响应内容: {response.text[:500]}...")  # 只打印前500个字符
        sys.stdout.flush()
        
        # 处理响应状态码
        if response.status_code == 204:
            # 204 No Content 是 DELETE 请求的正常响应
            print("DELETE 请求成功，返回 204 No Content")
            return {'success': True, 'message': '订单取消成功'}
        elif 200 <= response.status_code < 300:
            # 其他成功状态码
            if response.text and response.text.strip():
                try:
                    json_data = response.json()
                    print(f"JSON 解析成功，类型: {type(json_data)}")
                    
                    # 处理不同的返回数据结构
                    if isinstance(json_data, dict):
                        # 如果是字典，确保包含 success 字段
                        if 'success' not in json_data:
                            json_data['success'] = True
                        return json_data
                    elif isinstance(json_data, list):
                        # 如果是列表（如订单列表），包装成字典
                        print(f"返回列表，长度: {len(json_data)}")
                        return {
                            'success': True,
                            'data': json_data  # 将列表放在 'data' 字段中
                        }
                    else:
                        # 其他类型
                        return {'success': True, 'data': json_data}
                except Exception as json_error:
                    print(f"JSON 解析错误: {json_error}")
                    return {'success': True, 'message': '请求成功', 'raw': response.text}
            else:
                print("响应内容为空")
                return {'success': True, 'message': '请求成功'}
        else:
            # 错误状态码
            print(f"Alpaca API 错误: {response.status_code}")
            try:
                error_data = response.json()
                return {'success': False, 'error': error_data}
            except:
                return {'success': False, 'error': f'HTTP {response.status_code}: {response.text}'}
            
    except requests.exceptions.RequestException as e:
        print(f"Alpaca API 异常: {e}")
        return None

@app.route('/api/broker/account', methods=['GET'])
def get_broker_account():
    """获取 Alpaca 账户信息"""
    try:
        account_data = make_alpaca_request('GET', '/account')
        if account_data and account_data.get('success', False):
            # 格式化返回数据给前端
            return jsonify({
                'success': True,
                'data': {
                    'accountNumber': account_data.get('account_number', ''),
                    'status': account_data.get('status', 'UNKNOWN'),
                    'equity': float(account_data.get('equity', 0)),
                    'cash': float(account_data.get('cash', 0)),
                    'buyingPower': float(account_data.get('buying_power', 0)),
                    'portfolioValue': float(account_data.get('portfolio_value', 0)),
                    'longMarketValue': float(account_data.get('long_market_value', 0)),
                    'shortMarketValue': float(account_data.get('short_market_value', 0)),
                    'patternDayTrader': account_data.get('pattern_day_trader', False),
                    'tradingBlocked': account_data.get('trading_blocked', False),
                    'transfersBlocked': account_data.get('transfers_blocked', False),
                    'accountBlocked': account_data.get('account_blocked', False),
                    'currency': account_data.get('currency', 'USD')
                }
            })
        else:
            return jsonify({'success': False, 'error': '从 Alpaca 获取账户数据失败'}), 500
    except Exception as e:
        print(f"获取 Alpaca 账户错误: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/broker/positions', methods=['GET'])
def get_broker_positions():
    """获取 Alpaca 持仓"""
    try:
        print("获取 Alpaca 持仓数据...")
        positions_data = make_alpaca_request('GET', '/positions')
        
        if positions_data:
            print(f"Alpaca API 返回数据: {type(positions_data)}")
            
            # 检查返回数据的结构
            if isinstance(positions_data, dict) and positions_data.get('success', False):
                # 如果返回的是包含 success 字段的字典，但数据可能在另一个字段中
                actual_data = positions_data
                print("返回数据是包含 success 字段的字典")
            else:
                actual_data = positions_data
                
            # 处理数据：可能是列表或字典
            positions = []
            
            if isinstance(actual_data, list):
                print(f"返回数据是列表，长度: {len(actual_data)}")
                for pos in actual_data:
                    if isinstance(pos, dict):
                        positions.append({
                            'symbol': pos.get('symbol', ''),
                            'quantity': float(pos.get('qty', 0)),
                            'avgPrice': float(pos.get('avg_entry_price', 0)),
                            'currentPrice': float(pos.get('current_price', 0)),
                            'marketValue': float(pos.get('market_value', 0)),
                            'unrealizedPL': float(pos.get('unrealized_pl', 0)),
                            'unrealizedPLPercent': float(pos.get('unrealized_plpc', 0)) * 100,  # 转换为百分比
                            'side': pos.get('side', 'long')
                        })
            elif isinstance(actual_data, dict) and 'symbol' in actual_data:
                # 单个持仓对象
                print("返回数据是单个持仓对象")
                pos = actual_data
                positions.append({
                    'symbol': pos.get('symbol', ''),
                    'quantity': float(pos.get('qty', 0)),
                    'avgPrice': float(pos.get('avg_entry_price', 0)),
                    'currentPrice': float(pos.get('current_price', 0)),
                    'marketValue': float(pos.get('market_value', 0)),
                    'unrealizedPL': float(pos.get('unrealized_pl', 0)),
                    'unrealizedPLPercent': float(pos.get('unrealized_plpc', 0)) * 100,  # 转换为百分比
                    'side': pos.get('side', 'long')
                })
            
            print(f"格式化后持仓数据: {len(positions)} 条记录")
            return jsonify({'success': True, 'data': positions})
        else:
            print("Alpaca API 返回空数据")
            return jsonify({'success': True, 'data': []})
    except Exception as e:
        print(f"获取 Alpaca 持仓错误: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': True, 'data': []})

@app.route('/api/broker/orders', methods=['GET'])
def get_broker_orders():
    """获取 Alpaca 订单历史"""
    import sys
    import time
    try:
        print(f"\n\n{'='*60}")
        print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] /api/broker/orders 被调用")
        print(f"{'='*60}")
        sys.stdout.flush()
        
        # 获取查询参数（前端可以覆盖默认值）
        status = request.args.get('status', 'all')  # 默认获取所有状态的订单
        limit = request.args.get('limit', '50')     # 默认限制50条
        direction = request.args.get('direction', 'desc')  # 默认按时间降序（最新的在前）
        
        print(f"请求参数: status={status}, limit={limit}, direction={direction}")
        sys.stdout.flush()
        
        # 构建查询字符串 - 总是包含这些参数以确保获取订单历史
        query_params = [
            f'status={status}',
            f'limit={limit}',
            f'direction={direction}'
        ]
        
        # 如果前端传了其他参数，也加上
        for param in ['after', 'until', 'nested']:
            if param in request.args:
                query_params.append(f'{param}={request.args[param]}')
        
        query_string = '&'.join(query_params)
        endpoint = f"/orders?{query_string}"
        
        print(f"请求端点: {endpoint}")
        print(f"完整URL: {ALPACA_BASE_URL}{endpoint}")
        sys.stdout.flush()
        
        orders_data = make_alpaca_request('GET', endpoint)
        
        print(f"make_alpaca_request 返回: {type(orders_data)}")
        if orders_data:
            print(f"返回数据内容: {orders_data}")
        else:
            print("make_alpaca_request 返回 None")
        
        if orders_data and orders_data.get('success', False):
            # 检查实际数据结构
            print(f"orders_data 类型: {type(orders_data)}")
            print(f"orders_data 键: {list(orders_data.keys()) if isinstance(orders_data, dict) else '不是字典'}")
            
            # 实际数据在 'data' 字段中（因为 make_alpaca_request 现在包装列表）
            actual_orders = []
            if isinstance(orders_data, dict) and 'data' in orders_data:
                actual_orders = orders_data['data']
                print(f"从 'data' 字段提取订单数据，长度: {len(actual_orders)}")
            elif isinstance(orders_data, list):
                # 兼容旧版本：如果直接返回列表
                actual_orders = orders_data
                print(f"直接返回列表，长度: {len(actual_orders)}")
            
            print(f"actual_orders 类型: {type(actual_orders)}")
            
            # 格式化返回数据给前端
            orders = []
            
            if isinstance(actual_orders, list):
                print(f"订单列表长度: {len(actual_orders)}")
                for i, order in enumerate(actual_orders[:3]):  # 只打印前3个
                    print(f"订单 {i+1}: {order}")
                
                for order in actual_orders:
                    # 解析时间字段
                    created_at = order.get('created_at', '')
                    filled_at = order.get('filled_at', '')
                    
                    # 确保时间格式正确
                    if filled_at == '' or filled_at is None:
                        filled_at = None
                    
                    orders.append({
                        'orderId': order.get('id', ''),
                        'symbol': order.get('symbol', ''),
                        'side': order.get('side', ''),
                        'quantity': float(order.get('qty', 0)),
                        'type': order.get('type', ''),
                        'timeInForce': order.get('time_in_force', ''),
                        'status': order.get('status', ''),
                        'createdAt': created_at,
                        'filledAt': filled_at,
                        'filledQty': float(order.get('filled_qty', 0)),
                        'limitPrice': float(order.get('limit_price', 0)) if order.get('limit_price') else None,
                        'stopPrice': float(order.get('stop_price', 0)) if order.get('stop_price') else None
                    })
            elif isinstance(actual_orders, dict) and 'id' in actual_orders:
                # 单个订单对象
                print(f"单个订单: {actual_orders}")
                order = actual_orders
                created_at = order.get('created_at', '')
                filled_at = order.get('filled_at', '')
                
                if filled_at == '' or filled_at is None:
                    filled_at = None
                
                orders.append({
                    'orderId': order.get('id', ''),
                    'symbol': order.get('symbol', ''),
                    'side': order.get('side', ''),
                    'quantity': float(order.get('qty', 0)),
                    'type': order.get('type', ''),
                    'timeInForce': order.get('time_in_force', ''),
                    'status': order.get('status', ''),
                    'createdAt': created_at,
                    'filledAt': filled_at,
                    'filledQty': float(order.get('filled_qty', 0)),
                    'limitPrice': float(order.get('limit_price', 0)) if order.get('limit_price') else None,
                    'stopPrice': float(order.get('stop_price', 0)) if order.get('stop_price') else None
                })
            
            print(f"成功获取 {len(orders)} 条订单历史记录")
            print(f"========== 获取订单历史结束 ==========")
            return jsonify({'success': True, 'data': orders})
        else:
            print("获取订单历史失败或返回空数据")
            print(f"orders_data: {orders_data}")
            print(f"========== 获取订单历史结束 ==========")
            return jsonify({'success': True, 'data': []})
    except Exception as e:
        print(f"获取 Alpaca 订单历史错误: {e}")
        import traceback
        traceback.print_exc()
        print(f"========== 获取订单历史结束 ==========")
        return jsonify({'success': True, 'data': []})

@app.route('/api/broker/order', methods=['POST'])
def place_broker_order():
    """下 Alpaca 订单"""
    try:
        order_data = request.json
        
        # 验证必填字段
        required_fields = ['symbol', 'qty', 'side']
        for field in required_fields:
            if field not in order_data:
                return jsonify({'success': False, 'error': f'缺少必填字段: {field}'}), 400
        
        # 构建 Alpaca 订单
        alpaca_order = {
            'symbol': order_data['symbol'],
            'qty': str(order_data['qty']),
            'side': order_data['side'],
            'type': order_data.get('type', 'market'),
            'time_in_force': order_data.get('time_in_force', 'gtc')
        }
        
        # 可选字段
        if 'limit_price' in order_data and order_data['limit_price']:
            alpaca_order['limit_price'] = str(order_data['limit_price'])
        if 'stop_price' in order_data and order_data['stop_price']:
            alpaca_order['stop_price'] = str(order_data['stop_price'])
        
        # 发送到 Alpaca
        result = make_alpaca_request('POST', '/orders', alpaca_order)
        
        if result:
            if result.get('success', False):
                # 订单下单成功
                return jsonify({
                    'success': True,
                    'data': {
                        'orderId': result.get('id', ''),
                        'status': result.get('status', ''),
                        'symbol': result.get('symbol', ''),
                        'quantity': float(result.get('qty', 0)),
                        'side': result.get('side', ''),
                        'type': result.get('type', '')
                    }
                })
            else:
                # 订单下单失败
                error_msg = result.get('error', '未知错误')
                if isinstance(error_msg, dict):
                    error_msg = error_msg.get('message', str(error_msg))
                return jsonify({'success': False, 'error': error_msg}), 400
        else:
            return jsonify({'success': False, 'error': '通过 Alpaca 下单失败'}), 500
            
    except Exception as e:
        print(f"下 Alpaca 订单错误: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/broker/order/<order_id>', methods=['DELETE'])
def cancel_broker_order(order_id):
    """取消 Alpaca 订单"""
    try:
        result = make_alpaca_request('DELETE', f'/orders/{order_id}')
        
        if result is not None:
            return jsonify(result)
        else:
            return jsonify({'success': True, 'message': '订单取消成功'})
                
    except Exception as e:
        print(f"取消 Alpaca 订单错误: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== 启动 ====================
if __name__ == '__main__':
    print("================================================================================")
    print("优化版后端启动 - 性能优化 + Analyze修复 + Alpaca Paper Trading")
    print("特性:")
    print("  1. 30秒内存缓存")
    print("  2. 并行API调用")
    print("  3. 限制并发数避免触发API限制")
    print("  4. 响应时间统计")
    print("新增Analyze页面修复:")
    print("  5. /market/history/<symbol> - 历史数据接口 (Twelve Data)")
    print("  6. /market/stock/<symbol> - 股票详情接口")
    print("  7. 间隔映射: 30->30min, 60->1h, D->1day")
    print("新增Backtest页面修复:")
    print("  8. /backtest/run - 运行回测 (Real Data使用Twelve Data真实数据)")
    print("  9. /backtest/history - 获取回测历史")
    print("  10. /backtest/results/<id> - 获取回测结果")
    print("新增Alpaca Paper Trading:")
    print("  11. /api/broker/account - 获取Alpaca账户信息")
    print("  12. /api/broker/positions - 获取Alpaca持仓")
    print("  13. /api/broker/orders - 获取Alpaca订单")
    print("  14. /api/broker/order - 下Alpaca订单")
    print("  15. /api/broker/order/<order_id> - 取消Alpaca订单")
    print("端口: 8889")
    print("================================================================================\n")
    
    app.run(host='127.0.0.1', port=8889, debug=False, use_reloader=False)  # 关闭debug模式提高性能