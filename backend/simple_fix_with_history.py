"""
修复版后端 - 添加历史数据接口修复404问题
"""
from flask import Flask, request, jsonify
import requests
import time
import random
from datetime import datetime, timedelta

app = Flask(__name__)

# API密钥
TWELVEDATA_API_KEY = '4c486f3044124045a3bb48c1b6bc0a1b'
FINNHUB_API_KEY = 'd6v2q09r01qig546aus0d6v2q09r01qig546ausg'

# ==================== 工具函数 ====================
def safe_float(value, default=0.0):
    """安全转换为float"""
    try:
        return float(value)
    except (ValueError, TypeError):
        return float(default)

# ==================== Finnhub API ====================
def get_finnhub_quote(symbol):
    """获取股票报价"""
    try:
        url = "https://finnhub.io/api/v1/quote"
        params = {'symbol': symbol.upper(), 'token': FINNHUB_API_KEY}
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            return None, f"HTTP错误: {response.status_code}"
        
        data = response.json()
        if 'error' in data:
            return None, data.get('error', '未知错误')
        
        if data.get('c', 0) == 0:
            return None, "价格数据为0"
        
        return data, None
    except Exception as e:
        return None, str(e)

def get_finnhub_profile(symbol):
    """获取股票profile信息（包含市值）"""
    try:
        url = "https://finnhub.io/api/v1/stock/profile2"
        params = {'symbol': symbol.upper(), 'token': FINNHUB_API_KEY}
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            return None, f"HTTP错误: {response.status_code}"
        
        data = response.json()
        if 'error' in data:
            return None, data.get('error', '未知错误')
        
        if not data or len(data) == 0:
            return None, "空响应"
        
        if 'marketCapitalization' not in data:
            return None, "没有marketCapitalization字段"
        
        return data, None
        
    except Exception as e:
        return None, str(e)

# ==================== 模拟数据生成函数 ====================
def generate_mock_data(symbol, interval, range_param, base_price=100.0):
    """生成模拟历史数据（当API失败时使用）"""
    print(f"[模拟数据] 为 {symbol} 生成模拟数据: interval={interval}, range={range_param}")
    
    # 根据range确定数据点数量
    points_map = {
        '1day': 390,   # 1分钟数据，6.5小时 * 60分钟
        '1week': 40,   # 1小时数据，5天 * 8小时
        '1month': 30,  # 日线数据
        '3month': 90,  # 日线数据
        '1year': 252   # 日线数据
    }
    
    data_points = points_map.get(range_param, 30)
    
    # 生成时间序列
    historical_data = []
    now = datetime.now()
    
    for i in range(data_points):
        # 根据interval计算时间偏移
        if interval == '1min':
            time_offset = timedelta(minutes=-(data_points - i - 1))
        elif interval == '5min':
            time_offset = timedelta(minutes=-5*(data_points - i - 1))
        elif interval == '15min':
            time_offset = timedelta(minutes=-15*(data_points - i - 1))
        elif interval == '30min':
            time_offset = timedelta(minutes=-30*(data_points - i - 1))
        elif interval == '60':
            time_offset = timedelta(hours=-(data_points - i - 1))
        elif interval == 'D':
            time_offset = timedelta(days=-(data_points - i - 1))
        else:
            time_offset = timedelta(hours=-(data_points - i - 1))
        
        timestamp = now + time_offset
        
        # 生成价格数据（带随机波动）
        if i == 0:
            price = base_price
        else:
            # 基于前一个价格生成新价格
            prev_price = historical_data[-1]['close']
            change_percent = random.uniform(-0.02, 0.02)  # ±2%波动
            price = prev_price * (1 + change_percent)
        
        # 生成OHLC数据
        open_price = price * (1 + random.uniform(-0.005, 0.005))
        high_price = max(open_price, price) * (1 + random.uniform(0, 0.01))
        low_price = min(open_price, price) * (1 - random.uniform(0, 0.01))
        close_price = price
        
        historical_data.append({
            "datetime": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "time": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "timestamp": int(timestamp.timestamp()),
            "open": round(open_price, 2),
            "high": round(high_price, 2),
            "low": round(low_price, 2),
            "close": round(close_price, 2),
            "volume": random.randint(1000000, 5000000)
        })
    
    print(f"[模拟数据] 生成 {len(historical_data)} 个数据点")
    return historical_data

# ==================== Twelve Data API ====================
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
            historical_data.append({
                "datetime": item.get('datetime', ''),
                "time": item.get('datetime', ''),
                "timestamp": int(datetime.strptime(item['datetime'], "%Y-%m-%d %H:%M:%S").timestamp()) if 'datetime' in item else 0,
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

# ==================== 历史数据路由 ====================
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
        
        # 首先尝试从Twelve Data获取数据
        historical_data, success, data_source_note = get_twelvedata_history(symbol, interval, range_param)
        
        if not success or not historical_data:
            print(f"[历史数据接口] Twelve Data失败，使用模拟数据")
            # 获取当前价格作为基准
            quote_data, quote_error = get_finnhub_quote(symbol)
            base_price = 100.0  # 默认基准价格
            if quote_data and not quote_error:
                base_price = safe_float(quote_data.get('c', 100.0))
            
            # 生成模拟数据
            historical_data = generate_mock_data(symbol, interval, range_param, base_price)
            data_source_note = "模拟数据 (API失败)"
        
        # 返回数据
        return jsonify({
            "symbol": symbol.upper(),
            "interval": interval,
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

# ==================== 现有路由（保持不变） ====================
@app.route('/market/stocks', methods=['GET'])
@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """股票列表接口"""
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
        
        stocks = []
        success_count = 0
        
        for symbol in symbols:
            try:
                # 获取报价数据
                quote_data, quote_error = get_finnhub_quote(symbol)
                
                if quote_error or not quote_data:
                    stock_data = {
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
                    }
                else:
                    # 解析报价数据
                    current_price = safe_float(quote_data.get('c'), 0)
                    change_amount = safe_float(quote_data.get('d'), 0)
                    change_percent = safe_float(quote_data.get('dp'), 0)
                    day_high = safe_float(quote_data.get('h'), 0)
                    day_low = safe_float(quote_data.get('l'), 0)
                    open_price = safe_float(quote_data.get('o'), 0)
                    previous_close = safe_float(quote_data.get('pc'), 0)
                    
                    # 获取profile数据（包含市值）
                    profile_data, profile_error = get_finnhub_profile(symbol)
                    market_cap = None
                    
                    if profile_data and not profile_error:
                        raw_market_cap = safe_float(profile_data.get('marketCapitalization'), 0)
                        if raw_market_cap > 0:
                            market_cap = raw_market_cap * 1000000  # 百万转换为实际数值
                    
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
                    success_count += 1
                
                stocks.append(stock_data)
                
            except Exception as e:
                stocks.append({
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
                    "dataSource": "Finnhub (异常)",
                    "timestamp": int(time.time()),
                    "error": str(e)
                })
        
        return jsonify({
            "stocks": stocks,
            "count": len(stocks),
            "dataSource": "Finnhub",
            "successCount": success_count,
            "failedCount": len(symbols) - success_count,
            "timestamp": int(time.time())
        }), 200
        
    except Exception as e:
        return jsonify({
            "stocks": [],
            "count": 0,
            "dataSource": "Finnhub (错误)",
            "error": str(e),
            "timestamp": int(time.time())
        }), 500

@app.route('/api/status', methods=['GET'])
@app.route('/status', methods=['GET'])
def get_status():
    """系统状态接口"""
    return jsonify({
        "status": "online",
        "timestamp": int(time.time()),
        "version": "1.0.0-with-history-fix"
    }), 200

# ==================== 启动 ====================
if __name__ == '__main__':
    print("================================================================================")
    print("修复版后端启动 - 包含历史数据接口修复")
    print("新增功能:")
    print("  1. /market/history/<symbol> 历史数据接口")
    print("  2. /api/market/history/<symbol> 历史数据接口")
    print("  3. Twelve Data API集成")
    print("  4.