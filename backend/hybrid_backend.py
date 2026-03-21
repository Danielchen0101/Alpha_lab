#!/usr/bin/env python3
"""
Hybrid Backend - 混合方案：真实报价 + 高质量模拟历史数据
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import time
from datetime import datetime, timedelta
import requests
import random

app = Flask(__name__)
CORS(app)

# Finnhub API配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

# 缓存真实报价
quote_cache = {}
CACHE_DURATION = 60  # 缓存60秒

def get_real_time_quote(symbol):
    """获取实时报价"""
    cache_key = f"quote_{symbol}"
    
    # 检查缓存
    if cache_key in quote_cache:
        cached_data, cached_time = quote_cache[cache_key]
        if time.time() - cached_time < CACHE_DURATION:
            return cached_data
    
    try:
        url = f"{FINNHUB_BASE_URL}/quote"
        params = {
            'symbol': symbol.upper(),
            'token': FINNHUB_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            quote_data = {
                'current': data.get('c', 0),
                'high': data.get('h', 0),
                'low': data.get('l', 0),
                'open': data.get('o', 0),
                'previous_close': data.get('pc', 0),
                'timestamp': int(time.time())
            }
            
            # 更新缓存
            quote_cache[cache_key] = (quote_data, time.time())
            return quote_data
    except:
        pass
    
    return None

def generate_quality_history_data(symbol, interval, range_param, current_price):
    """生成高质量模拟历史数据（基于真实价格模式）"""
    
    # 获取时间范围
    now = datetime.now()
    
    if range_param == '1day':
        days_back = 1
        points = 7  # 7个数据点（每3-4小时一个）
        volatility = 0.02  # 2%波动
    elif range_param == '1week':
        days_back = 7
        points = 32  # 32个数据点（每天4-5个）
        volatility = 0.03  # 3%波动
    elif range_param == '1month':
        days_back = 30
        points = 20  # 20个交易日
        volatility = 0.05  # 5%波动
    elif range_param == '3month':
        days_back = 90
        points = 60  # 60个交易日
        volatility = 0.08  # 8%波动
    elif range_param == '1year':
        days_back = 365
        points = 252  # 252个交易日
        volatility = 0.15  # 15%波动
    else:
        days_back = 30
        points = 20
        volatility = 0.05
    
    data_points = []
    base_time = int(time.time())
    
    # 基于当前价格生成合理的历史价格
    # 使用随机游走模型，但确保最终价格接近当前价格
    price = current_price
    
    for i in range(points, 0, -1):
        timestamp = base_time - (86400 * i)
        
        # 随机波动
        change_percent = (random.random() - 0.5) * 2 * volatility
        price = price * (1 + change_percent)
        
        # 确保价格在合理范围内
        if price < current_price * 0.5:  # 不低于当前价格的50%
            price = current_price * 0.5 + random.random() * current_price * 0.1
        if price > current_price * 1.5:  # 不高于当前价格的150%
            price = current_price * 1.5 - random.random() * current_price * 0.1
        
        # 生成OHLC数据
        open_price = price
        close_price = price * (1 + (random.random() - 0.5) * 0.01)  # ±0.5%日内波动
        high_price = max(open_price, close_price) * (1 + random.random() * 0.02)  # 最高价比收盘高0-2%
        low_price = min(open_price, close_price) * (1 - random.random() * 0.02)   # 最低价比收盘低0-2%
        
        # 确保high > low
        if high_price <= low_price:
            high_price = low_price * 1.01
        
        data_points.append({
            "timestamp": timestamp,
            "time": datetime.fromtimestamp(timestamp).isoformat(),
            "open": round(open_price, 2),
            "high": round(high_price, 2),
            "low": round(low_price, 2),
            "close": round(close_price, 2),
            "volume": random.randint(1000000, 10000000)
        })
    
    # 调整最后一个数据点的收盘价，使其接近当前价格
    if data_points:
        last_point = data_points[-1]
        last_point['close'] = round(current_price, 2)
        last_point['open'] = round(current_price * (1 + (random.random() - 0.5) * 0.005), 2)
        last_point['high'] = round(max(last_point['open'], last_point['close']) * 1.01, 2)
        last_point['low'] = round(min(last_point['open'], last_point['close']) * 0.99, 2)
    
    return data_points

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取股票历史价格数据 - 混合方案"""
    print(f"\n{'='*80}")
    print(f"[历史数据请求] 混合方案")
    print(f"  符号: {symbol}")
    print(f"  参数: interval={request.args.get('interval', 'D')}, range={request.args.get('range', '1month')}")
    
    interval = request.args.get('interval', 'D')
    range_param = request.args.get('range', '1month')
    
    try:
        # 首先尝试获取实时报价
        quote_data = get_real_time_quote(symbol)
        
        if quote_data:
            current_price = quote_data['current']
            print(f"  获取到实时报价: ${current_price}")
            
            # 生成高质量模拟历史数据
            data_points = generate_quality_history_data(symbol, interval, range_param, current_price)
            
            if data_points:
                closes = [p['close'] for p in data_points]
                print(f"  生成模拟数据: {len(data_points)}条")
                print(f"  价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
                print(f"  最后收盘价: ${closes[-1]:.2f} (当前价格: ${current_price})")
                print(f"  前5个close: {[f'${c:.2f}' for c in closes[:5]]}")
                print(f"  后5个close: {[f'${c:.2f}' for c in closes[-5:]]}")
                
                return jsonify({
                    "symbol": symbol.upper(),
                    "interval": interval,
                    "range": range_param,
                    "data": data_points,
                    "count": len(data_points),
                    "dataSource": "混合数据 (实时报价 + 模拟历史)",
                    "timestamp": time.time(),
                    "currentPrice": current_price,
                    "note": "基于实时报价生成的高质量模拟历史数据",
                    "isSimulated": True,
                    "hasRealQuote": True
                })
        
        # 如果获取实时报价失败，使用默认模拟
        print(f"  无法获取实时报价，使用默认模拟数据")
        
        # 默认基础价格
        default_prices = {
            'AAPL': 248.18,
            'NVDA': 179.11,
            'TSLA': 245.23,
            'MSFT': 415.86,
            'GOOGL': 175.34
        }
        
        base_price = default_prices.get(symbol.upper(), 100.0)
        data_points = generate_quality_history_data(symbol, interval, range_param, base_price)
        
        return jsonify({
            "symbol": symbol.upper(),
            "interval": interval,
            "range": range_param,
            "data": data_points,
            "count": len(data_points),
            "dataSource": "模拟数据 (无法获取实时报价)",
            "timestamp": time.time(),
            "note": "使用默认价格的模拟历史数据",
            "isSimulated": True,
            "hasRealQuote": False
        })
        
    except Exception as e:
        print(f"  处理异常: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "symbol": symbol.upper(),
            "interval": interval,
            "range": range_param,
            "data": [],
            "count": 0,
            "dataSource": "数据获取失败",
            "timestamp": time.time(),
            "error": f"获取数据失败: {str(e)}"
        })

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_data(symbol):
    """获取单个股票数据 - 使用真实报价"""
    print(f"[单股详情] 请求: {symbol}")
    
    # 股票信息数据库
    stock_info_db = {
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
    
    symbol_upper = symbol.upper()
    info = stock_info_db.get(symbol_upper, {
        'name': f'{symbol_upper} Company',
        'sector': 'General',
        'marketCap': 1000000000000,  # 1万亿
        'defaultPrice': 100.0
    })
    
    try:
        # 尝试获取实时报价
        quote_data = get_real_time_quote(symbol)
        
        if quote_data:
            print(f"  使用实时报价: ${quote_data['current']}")
            
            return jsonify({
                "symbol": symbol_upper,
                "name": info['name'],
                "price": quote_data['current'],
                "change": quote_data['current'] - quote_data['previous_close'],
                "changePercent": ((quote_data['current'] - quote_data['previous_close']) / quote_data['previous_close']) * 100 if quote_data['previous_close'] else 0,
                "marketCap": info['marketCap'],
                "sector": info['sector'],
                "dayHigh": quote_data['high'],
                "dayLow": quote_data['low'],
                "previousClose": quote_data['previous_close'],
                "volume": 10000000,
                "dataSource": "Finnhub (实时报价)",
                "timestamp": quote_data['timestamp']
            })
    
    except Exception as e:
        print(f"  获取实时报价失败: {e}")
    
    # 回退到模拟数据
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
    
    # 股票信息数据库
    stock_info_db = {
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
    
    symbols = request.args.get('symbols', '')
    if symbols:
        # 返回指定符号的股票
        symbol_list = [s.strip().upper() for s in symbols.split(',') if s.strip()]
    else:
        # 返回所有股票
        symbol_list = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL']
    
    stocks_data = []
    
    for symbol in symbol_list:
        info = stock_info_db.get(symbol, {
            'name': f'{symbol} Company',
            'sector': 'General',
            'marketCap': 1000000000000,  # 1万亿
            'defaultPrice': 100.0
        })
        
        try:
            quote_data = get_real_time_quote(symbol)
            if quote_data:
                price = quote_data['current']
                change = price - quote_data['previous_close']
                change_percent = (change / quote_data['previous_close']) * 100 if quote_data['previous_close'] else 0
                data_source = "Finnhub (实时报价)"
            else:
                price = info['defaultPrice']
                change = 0.0
                change_percent = 0.0
                data_source = "模拟数据"
        except:
            price = info['defaultPrice']
            change = 0.0
            change_percent = 0.0
            data_source = "模拟数据"
        
        stocks_data.append({
            "symbol": symbol,
            "name": info['name'],
            "price": price,
            "change": change,
            "changePercent": change_percent,
            "marketCap": info['marketCap'],
            "sector": info['sector'],
            "currency": "USD",
            "dataSource": data_source,
            "timestamp": time.time()
        })
    
    return jsonify({
        "stocks": stocks_data,
        "count": len(stocks_data),
        "source": "混合数据",
        "timestamp": time.time(),
        "success": True,
        "elapsed": 0
    })

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取系统状态"""
    return jsonify({
        "status": "ok",
        "version": "1.0.0",
        "timestamp": time.time(),
        "dataSource": "混合方案 (实时报价 + 模拟历史)"
    })

if __name__ == '__main__':
    print("="*80)
    print("Hybrid Backend Server - 混合方案")
    print("="*80)
    print("方案: 实时报价 + 高质量模拟历史数据")
    print("优势:")
    print("  1. 使用真实实时报价")
    print("  2. 生成合理的历史价格模式")
    print("  3. 确保图表价格与当前价格一致")
    print("  4. 避免Finnhub API限制")
    print("="*80)
    print("Running on: http://127.0.0.1:8890")
    print("="*80)
    app.run(host='127.0.0.1', port=8890, debug=False)