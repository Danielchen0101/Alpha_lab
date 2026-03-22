"""
优化版后端 - 性能优化，减少Finnhub API调用
"""
from flask import Flask, request, jsonify
import requests
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import OrderedDict
import hashlib
from datetime import datetime

app = Flask(__name__)

# ==================== 配置 ====================
FINNHUB_API_KEY = 'd6v2q09r01qig546aus0d6v2q09r01qig546ausg'
TWELVEDATA_API_KEY = '4c486f3044124045a3bb48c1b6bc0a1b'

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

# 全局缓存实例
stock_cache = StockCache(ttl=CACHE_TTL, max_size=MAX_CACHE_SIZE)

# ==================== 工具函数 ====================
def safe_float(value, default=0.0):
    """安全转换为float"""
    try:
        return float(value)
    except (ValueError, TypeError):
        return float(default)

def get_cache_key(symbol, data_type='quote'):
    """生成缓存键"""
    return f"{symbol}_{data_type}"

def get_twelvedata_history(symbol, interval, range_param):
    """从Twelve Data获取历史数据"""
    print(f"[Twelve Data] 获取历史数据: {symbol}, interval={interval}, range={range_param}")
    
    try:
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
            '1day': 500,   # 1分钟数据需要500个点
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
        
        print(f"[Twelve Data] 成功获取 {len(historical_data)} 个数据点")
        return historical_data, True, "Twelve Data实时数据"
        
    except Exception as e:
        print(f"[Twelve Data] 异常: {e}")
        return None, False, f"Twelve Data异常: {str(e)}"

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
        
        # 使用优化版的API调用（带缓存）
        quote_data, quote_error = fetch_finnhub_quote(symbol)
        
        if quote_error or not quote_data:
            elapsed = time.time() - start_time
            return jsonify({
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
                "responseTime": round(elapsed, 3),
                "timestamp": int(time.time()),
                "error": quote_error or "未获取到数据"
            }), 500
        
        # 解析报价数据
        current_price = safe_float(quote_data.get('c'), 0)
        change_amount = safe_float(quote_data.get('d'), 0)
        change_percent = safe_float(quote_data.get('dp'), 0)
        day_high = safe_float(quote_data.get('h'), 0)
        day_low = safe_float(quote_data.get('l'), 0)
        open_price = safe_float(quote_data.get('o'), 0)
        previous_close = safe_float(quote_data.get('pc'), 0)
        
        # 获取profile数据（包含市值）- 使用优化版本
        profile_data, profile_error = fetch_finnhub_profile(symbol)
        market_cap = None
        
        if profile_data and not profile_error:
            raw_market_cap = safe_float(profile_data.get('marketCapitalization'), 0)
            if raw_market_cap > 0:
                market_cap = raw_market_cap * 1000000  # 百万转换为实际数值
        
        elapsed = time.time() - start_time
        
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
            "responseTime": round(elapsed, 3),
            "timestamp": int(time.time())
        }
        
        print(f"[股票详情接口] 返回数据: {symbol}, 价格: {current_price}, 响应时间: {round(elapsed, 3)}s")
        return jsonify(stock_data), 200
        
    except Exception as e:
        elapsed = time.time() - start_time if 'start_time' in locals() else 0
        print(f"[股票详情接口] 异常: {e}")
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
            "dataSource": "Finnhub (异常)",
            "responseTime": round(elapsed, 3),
            "timestamp": int(time.time()),
            "error": str(e)
        }), 500

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

# ==================== 启动 ====================
if __name__ == '__main__':
    print("================================================================================")
    print("优化版后端启动 - 性能优化 + Analyze修复")
    print("特性:")
    print("  1. 30秒内存缓存")
    print("  2. 并行API调用")
    print("  3. 限制并发数避免触发API限制")
    print("  4. 响应时间统计")
    print("新增Analyze页面修复:")
    print("  5. /market/history/<symbol> - 历史数据接口 (Twelve Data)")
    print("  6. /market/stock/<symbol> - 股票详情接口")
    print("  7. 间隔映射: 30->30min, 60->1h, D->1day")
    print("端口: 8889")
    print("================================================================================\n")
    
    app.run(host='127.0.0.1', port=8889, debug=False, use_reloader=False)  # 关闭debug模式提高性能