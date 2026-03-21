#!/usr/bin/env python3
"""
Dual Source Backend - Polygon历史数据 + Finnhub实时报价
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import time
from datetime import datetime, timedelta
import requests

app = Flask(__name__)
CORS(app)

# API配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

POLYGON_API_KEY = 'vx8LMXnMYMpBonwfXE2ssfqSo7WwcnlB'
POLYGON_BASE_URL = 'https://api.polygon.io'

# 股票信息数据库
STOCK_INFO_DB = {
    'AAPL': {
        'name': 'Apple Inc',
        'sector': 'Technology',
        'marketCap': 3800000000000,  # 3.8万亿
        'defaultPrice': 248.18
    },
    'NVDA': {
        'name': 'NVIDIA Corp',
        'sector': 'Technology',
        'marketCap': 4383719823517.77,  # 4.38万亿
        'defaultPrice': 179.11
    },
    'TSLA': {
        'name': 'Tesla Inc',
        'sector': 'Automotive',
        'marketCap': 780000000000,  # 0.78万亿
        'defaultPrice': 245.23
    },
    'MSFT': {
        'name': 'Microsoft Corp',
        'sector': 'Technology',
        'marketCap': 3090000000000,  # 3.09万亿
        'defaultPrice': 415.86
    },
    'GOOGL': {
        'name': 'Alphabet Inc',
        'sector': 'Technology',
        'marketCap': 2200000000000,  # 2.2万亿
        'defaultPrice': 175.34
    }
}

# ========== 数据源策略 ==========
# 1. Price Chart / 历史图表: Polygon为主，Finnhub为备
# 2. Quote / Profile / Summary: Finnhub为主，Polygon为备
# 3. 不再生成模拟历史数据

def get_finnhub_quote(symbol):
    """从Finnhub获取实时报价"""
    try:
        url = f"{FINNHUB_BASE_URL}/quote"
        params = {
            'symbol': symbol.upper(),
            'token': FINNHUB_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            return {
                'current': data.get('c', 0),
                'high': data.get('h', 0),
                'low': data.get('l', 0),
                'open': data.get('o', 0),
                'previous_close': data.get('pc', 0),
                'timestamp': int(time.time()),
                'source': 'Finnhub'
            }
    except Exception as e:
        print(f"  Finnhub报价请求失败: {e}")
    
    return None

def get_polygon_quote(symbol):
    """从Polygon获取实时报价（备用）"""
    try:
        url = f"{POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers/{symbol.upper()}"
        params = {
            'apiKey': POLYGON_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            if 'ticker' in data:
                ticker = data['ticker']
                last_trade = ticker.get('lastTrade', {})
                day_data = ticker.get('day', {})
                
                return {
                    'current': last_trade.get('p', 0),
                    'high': day_data.get('h', 0),
                    'low': day_data.get('l', 0),
                    'open': day_data.get('o', 0),
                    'previous_close': ticker.get('prevDay', {}).get('c', 0),
                    'timestamp': int(time.time()),
                    'source': 'Polygon'
                }
    except Exception as e:
        print(f"  Polygon报价请求失败: {e}")
    
    return None

def get_polygon_historical_data(symbol, interval, range_param):
    """从Polygon获取历史数据（主源）"""
    print(f"  尝试从Polygon获取历史数据...")
    
    # 映射参数
    resolution_map = {
        '60': 'minute',  # 60分钟
        'D': 'day'       # 日线
    }
    
    # 计算时间范围
    now = datetime.now()
    range_to_days = {
        '1day': 1,
        '1week': 7,
        '1month': 30,
        '3month': 90,
        '1year': 365
    }
    
    days_back = range_to_days.get(range_param, 30)
    end_date = now.strftime('%Y-%m-%d')
    start_date = (now - timedelta(days=days_back)).strftime('%Y-%m-%d')
    resolution = resolution_map.get(interval, 'day')
    
    try:
        url = f"{POLYGON_BASE_URL}/v2/aggs/ticker/{symbol.upper()}/range/1/{resolution}/{start_date}/{end_date}"
        params = {
            'apiKey': POLYGON_API_KEY,
            'adjusted': 'true',
            'sort': 'asc'
        }
        
        print(f"  Polygon请求: {url}")
        response = requests.get(url, params=params, timeout=10)
        
        print(f"  Polygon响应状态: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('resultsCount', 0) > 0 and 'results' in data:
                results = data['results']
                
                # 格式化数据
                formatted_data = []
                for result in results:
                    # Polygon返回的时间戳是毫秒
                    timestamp_seconds = result['t'] / 1000
                    
                    formatted_data.append({
                        "timestamp": int(timestamp_seconds),
                        "time": datetime.fromtimestamp(timestamp_seconds).isoformat(),
                        "open": float(result['o']),
                        "high": float(result['h']),
                        "low": float(result['l']),
                        "close": float(result['c']),
                        "volume": int(result['v'])
                    })
                
                print(f"  成功从Polygon获取 {len(formatted_data)} 条历史数据")
                return formatted_data, True, 'Polygon'
            else:
                print(f"  Polygon无数据返回")
                return [], False, 'Polygon'
        else:
            print(f"  Polygon API错误: {response.status_code}")
            return [], False, 'Polygon'
            
    except Exception as e:
        print(f"  获取Polygon历史数据异常: {e}")
        return [], False, 'Polygon'

def get_finnhub_historical_data(symbol, interval, range_param):
    """从Finnhub获取历史数据（备用）"""
    print(f"  尝试从Finnhub获取历史数据...")
    
    # 映射参数
    resolution_map = {
        '60': '60',  # 60分钟
        'D': 'D'     # 日线
    }
    
    # 计算时间范围
    now = datetime.now()
    range_to_days = {
        '1day': 1,
        '1week': 7,
        '1month': 30,
        '3month': 90,
        '1year': 365
    }
    
    days_back = range_to_days.get(range_param, 30)
    from_time = int((now - timedelta(days=days_back)).timestamp())
    to_time = int(now.timestamp())
    resolution = resolution_map.get(interval, 'D')
    
    try:
        url = f"{FINNHUB_BASE_URL}/stock/candle"
        params = {
            'symbol': symbol.upper(),
            'resolution': resolution,
            'from': from_time,
            'to': to_time,
            'token': FINNHUB_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if data.get('s') == 'ok':
                # 格式化数据
                formatted_data = []
                timestamps = data.get('t', [])
                opens = data.get('o', [])
                highs = data.get('h', [])
                lows = data.get('l', [])
                closes = data.get('c', [])
                volumes = data.get('v', [])
                
                for i in range(len(timestamps)):
                    formatted_data.append({
                        "timestamp": timestamps[i],
                        "time": datetime.fromtimestamp(timestamps[i]).isoformat(),
                        "open": float(opens[i]) if i < len(opens) else 0,
                        "high": float(highs[i]) if i < len(highs) else 0,
                        "low": float(lows[i]) if i < len(lows) else 0,
                        "close": float(closes[i]) if i < len(closes) else 0,
                        "volume": int(volumes[i]) if i < len(volumes) else 0
                    })
                
                print(f"  成功从Finnhub获取 {len(formatted_data)} 条历史数据")
                return formatted_data, True, 'Finnhub'
            else:
                print(f"  Finnhub数据错误: {data.get('s')}")
                return [], False, 'Finnhub'
        else:
            print(f"  Finnhub API错误: {response.status_code}")
            return [], False, 'Finnhub'
            
    except Exception as e:
        print(f"  获取Finnhub历史数据异常: {e}")
        return [], False, 'Finnhub'

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取股票历史价格数据 - Polygon为主，Finnhub为备"""
    print(f"\n{'='*80}")
    print(f"[历史数据请求] 双源策略")
    print(f"  符号: {symbol}")
    print(f"  参数: interval={request.args.get('interval', 'D')}, range={request.args.get('range', '1month')}")
    
    interval = request.args.get('interval', 'D')
    range_param = request.args.get('range', '1month')
    
    # 策略: Polygon为主，Finnhub为备
    print(f"  策略: Polygon为主，Finnhub为备")
    
    # 1. 首先尝试Polygon
    polygon_data, polygon_success, polygon_source = get_polygon_historical_data(symbol, interval, range_param)
    
    if polygon_success and polygon_data:
        # Polygon成功
        closes = [d['close'] for d in polygon_data]
        print(f"  ✅ 使用Polygon历史数据: {len(polygon_data)}条")
        print(f"     价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
        print(f"     最后收盘价: ${closes[-1]:.2f}")
        
        return jsonify({
            "symbol": symbol.upper(),
            "interval": interval,
            "range": range_param,
            "data": polygon_data,
            "count": len(polygon_data),
            "dataSource": f"{polygon_source} (历史数据)",
            "timestamp": time.time(),
            "isRealData": True,
            "note": "真实历史candles数据"
        })
    
    # 2. Polygon失败，尝试Finnhub
    print(f"  ⚠️ Polygon失败，尝试Finnhub...")
    finnhub_data, finnhub_success, finnhub_source = get_finnhub_historical_data(symbol, interval, range_param)
    
    if finnhub_success and finnhub_data:
        # Finnhub成功
        closes = [d['close'] for d in finnhub_data]
        print(f"  ⚠️ 使用Finnhub历史数据: {len(finnhub_data)}条")
        print(f"     价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
        print(f"     最后收盘价: ${closes[-1]:.2f}")
        
        return jsonify({
            "symbol": symbol.upper(),
            "interval": interval,
            "range": range_param,
            "data": finnhub_data,
            "count": len(finnhub_data),
            "dataSource": f"{finnhub_source} (历史数据)",
            "timestamp": time.time(),
            "isRealData": True,
            "note": "真实历史candles数据"
        })
    
    # 3. 两个数据源都失败
    print(f"  ❌ 两个数据源都失败，返回空数据")
    
    return jsonify({
        "symbol": symbol.upper(),
        "interval": interval,
        "range": range_param,
        "data": [],
        "count": 0,
        "dataSource": "数据不可用",
        "timestamp": time.time(),
        "isRealData": False,
        "error": "无法获取真实历史数据。Polygon和Finnhub历史数据API均不可用。",
        "note": "历史数据不可用，请检查API配置或使用其他数据源。",
        "suggestion": "前端应显示 'No historical data available'"
    })

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_data(symbol):
    """获取单个股票数据 - Finnhub为主，Polygon为备"""
    print(f"[单股详情] 请求: {symbol}")
    
    symbol_upper = symbol.upper()
    info = STOCK_INFO_DB.get(symbol_upper, {
        'name': f'{symbol_upper} Company',
        'sector': 'General',
        'marketCap': 1000000000000,
        'defaultPrice': 100.0
    })
    
    # 策略: Finnhub为主，Polygon为备
    print(f"  策略: Finnhub为主，Polygon为备")
    
    # 1. 首先尝试Finnhub
    finnhub_quote = get_finnhub_quote(symbol)
    
    if finnhub_quote:
        print(f"  ✅ 使用Finnhub实时报价: ${finnhub_quote['current']}")
        
        return jsonify({
            "symbol": symbol_upper,
            "name": info['name'],
            "price": finnhub_quote['current'],
            "change": finnhub_quote['current'] - finnhub_quote['previous_close'],
            "changePercent": ((finnhub_quote['current'] - finnhub_quote['previous_close']) / finnhub_quote['previous_close']) * 100 if finnhub_quote['previous_close'] else 0,
            "marketCap": info['marketCap'],
            "sector": info['sector'],
            "dayHigh": finnhub_quote['high'],
            "dayLow": finnhub_quote['low'],
            "previousClose": finnhub_quote['previous_close'],
            "volume": 10000000,
            "dataSource": f"{finnhub_quote['source']} (实时报价)",
            "timestamp": finnhub_quote['timestamp']
        })
    
    # 2. Finnhub失败，尝试Polygon
    print(f"  ⚠️ Finnhub失败，尝试Polygon...")
    polygon_quote = get_polygon_quote(symbol)
    
    if polygon_quote:
        print(f"  ⚠️ 使用Polygon实时报价: ${polygon_quote['current']}")
        
        return jsonify({
            "symbol": symbol_upper,
            "name": info['name'],
            "price": polygon_quote['current'],
            "change": polygon_quote['current'] - polygon_quote['previous_close'],
            "changePercent": ((polygon_quote['current'] - polygon_quote['previous_close']) / polygon_quote['previous_close']) * 100 if polygon_quote['previous_close'] else 0,
            "marketCap": info['marketCap'],
            "sector": info['sector'],
            "dayHigh": polygon_quote['high'],
            "dayLow": polygon_quote['low'],
            "previousClose": polygon_quote['previous_close'],
            "volume": 10000000,
            "dataSource": f"{polygon_quote['source']} (实时报价)",
            "timestamp": polygon_quote['timestamp']
        })
    
    # 3. 两个数据源都失败，使用默认数据
    print(f"  ❌ 两个数据源都失败，使用默认数据")
    price = info['defaultPrice']
    
    return jsonify({
        "symbol": symbol_upper,
        "name": info['name'],
        "price": price,
        "change": 0.0,
        "changePercent": 0.0,
        "marketCap": info['marketCap'],
        "sector": info['sector'],
        "dayHigh": price * 1.03,
        "dayLow": price * 0.97,
        "previousClose": price,
        "volume": 10000000,
        "dataSource": "模拟数据",
        "timestamp": time.time()
    })

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """获取市场股票列表"""
    print(f"[股票列表] 请求")
    
    symbols = request.args.get('symbols', '')
    if symbols:
        symbol_list = [s.strip().upper() for s in symbols.split(',') if s.strip()]
    else:
        symbol_list = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL']
    
    stocks_data = []
    
    for symbol in symbol_list:
        info =