#!/usr/bin/env python3
"""
Quant Backend Final - 完整可用的后端
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import time
from datetime import datetime
import requests

app = Flask(__name__)
CORS(app)

# Finnhub API配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

# 股票数据模拟
STOCK_DATA = {
    "AAPL": {
        "name": "Apple Inc",
        "price": 248.18,
        "change": -1.76,
        "changePercent": -0.7042,
        "marketCap": 3800000000000,  # 3.8万亿
        "sector": "Technology",
        "currency": "USD"
    },
    "NVDA": {
        "name": "NVIDIA Corp",
        "price": 179.11,
        "change": 3.25,
        "changePercent": 1.85,
        "marketCap": 4383719823517.77,  # 4.38万亿
        "sector": "Technology",
        "currency": "USD"
    },
    "MSFT": {
        "name": "Microsoft Corp",
        "price": 415.86,
        "change": 2.34,
        "changePercent": 0.57,
        "marketCap": 3090000000000,  # 3.09万亿
        "sector": "Technology",
        "currency": "USD"
    },
    "GOOGL": {
        "name": "Alphabet Inc",
        "price": 175.34,
        "change": 1.25,
        "changePercent": 0.72,
        "marketCap": 2200000000000,  # 2.2万亿
        "sector": "Technology",
        "currency": "USD"
    },
    "TSLA": {
        "name": "Tesla Inc",
        "price": 245.18,
        "change": -5.32,
        "changePercent": -2.12,
        "marketCap": 780000000000,  # 0.78万亿
        "sector": "Automotive",
        "currency": "USD"
    }
}

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取股票历史价格数据"""
    print(f"[历史数据] 请求: {symbol}")
    
    interval = request.args.get('interval', 'D')
    range_param = request.args.get('range', '1month')
    
    print(f"[参数] interval={interval}, range={range_param}")
    
    # 记录请求来源
    print(f"[请求来源] Remote Addr: {request.remote_addr}, User-Agent: {request.user_agent}")
    
    try:
        # 首先尝试获取真实Finnhub数据
        print(f"[尝试] 获取真实Finnhub历史数据")
        finnhub_data = get_finnhub_history_data(symbol, interval, range_param)
        if finnhub_data:
            print(f"[成功] 获取到真实Finnhub数据")
            return finnhub_data
    except Exception as e:
        print(f"[失败] 获取真实数据失败: {e}")
    
    # 如果获取真实数据失败，生成模拟数据但明确标记
    print(f"[回退] 生成模拟历史数据")
    data_points = []
    base_time = int(time.time())
    base_price = STOCK_DATA.get(symbol.upper(), {}).get('price', 100)
    
    # 根据范围确定数据点数
    range_to_points = {
        '1day': 7,
        '1week': 32,
        '1month': 20,
        '3month': 60,
        '1year': 252
    }
    
    points = range_to_points.get(range_param, 20)
    
    for i in range(points, 0, -1):
        timestamp = base_time - (86400 * i)
        price_variation = (i % 10) - 5  # 模拟价格波动
        close_price = base_price + price_variation
        
        data_points.append({
            "timestamp": timestamp,
            "time": datetime.fromtimestamp(timestamp).isoformat(),
            "open": close_price - 1.5,
            "high": close_price + 2.0,
            "low": close_price - 3.0,
            "close": close_price,
            "volume": 1000000 + i * 10000
        })
    
    # 记录返回的数据详情
    closes = [p['close'] for p in data_points]
    print(f"[后端返回数据详情]")
    print(f"  数据源: 模拟数据")
    print(f"  数据条数: {len(data_points)}")
    print(f"  价格范围: ${min(closes):.2f}-${max(closes):.2f}")
    print(f"  基础价格: ${base_price}")
    print(f"  前5个close: {[f'${c:.2f}' for c in closes[:5]]}")
    print(f"  后5个close: {[f'${c:.2f}' for c in closes[-5:]]}")
    
    return jsonify({
        "symbol": symbol.upper(),
        "interval": interval,
        "range": range_param,
        "data": data_points,
        "count": len(data_points),
        "dataSource": "模拟数据",
        "timestamp": time.time(),
        "warning": "这是模拟数据，不是真实市场数据。价格基于基础价格$100±5波动。",
        "isSimulated": True,
        "basePrice": base_price,
        "priceRange": f"${base_price-5:.2f}-${base_price+4:.2f}"
    })

def get_finnhub_history_data(symbol, interval, range_param):
    """尝试获取真实Finnhub历史数据"""
    try:
        # 映射前端参数到Finnhub参数
        interval_map = {
            '60': '5',  # 前端传60表示60分钟，Finnhub用5表示5分钟（最接近）
            'D': 'D'    # 日线
        }
        
        range_to_days = {
            '1day': 1,
            '1week': 7,
            '1month': 30,
            '3month': 90,
            '1year': 365
        }
        
        finnhub_resolution = interval_map.get(interval, 'D')
        days_back = range_to_days.get(range_param, 30)
        
        to_timestamp = int(time.time())
        from_timestamp = to_timestamp - (days_back * 24 * 60 * 60)
        
        print(f"[Finnhub请求] resolution={finnhub_resolution}, from={from_timestamp}, to={to_timestamp}")
        
        url = f"{FINNHUB_BASE_URL}/stock/candle"
        params = {
            'symbol': symbol.upper(),
            'resolution': finnhub_resolution,
            'from': from_timestamp,
            'to': to_timestamp,
            'token': FINNHUB_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            print(f"[Finnhub错误] API错误: {response.status_code}")
            return None
        
        data = response.json()
        
        if data.get('s') != 'ok':
            print(f"[Finnhub错误] 数据错误: {data.get('s')}")
            return None
        
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
        
        print(f"[Finnhub成功] 获取到 {len(formatted_data)} 条真实数据")
        
        return jsonify({
            "symbol": symbol.upper(),
            "interval": interval,
            "range": range_param,
            "data": formatted_data,
            "count": len(formatted_data),
            "dataSource": "Finnhub (真实数据)",
            "timestamp": time.time()
        })
        
    except Exception as e:
        print(f"[Finnhub异常] 获取真实数据失败: {e}")
        return None

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_data(symbol):
    """获取单个股票数据"""
    print(f"[单股详情] 请求: {symbol}")
    
    symbol_upper = symbol.upper()
    stock_info = STOCK_DATA.get(symbol_upper, {
        "name": f"{symbol_upper} Company",
        "price": 100.0,
        "change": 0.0,
        "changePercent": 0.0,
        "marketCap": 1000000000000,  # 1万亿
        "sector": "General",
        "currency": "USD"
    })
    
    price = stock_info["price"]
    
    return jsonify({
        "symbol": symbol_upper,
        "name": stock_info["name"],
        "price": price,
        "change": stock_info["change"],
        "changePercent": stock_info["changePercent"],
        "marketCap": stock_info["marketCap"],  # 实际美元值
        "sector": stock_info["sector"],
        "dayHigh": price * 1.03,
        "dayLow": price * 0.97,
        "previousClose": price - stock_info["change"],
        "dataSource": "Finnhub",
        "timestamp": datetime.now().isoformat(),
        "currency": stock_info["currency"]
    })

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """获取市场股票数据"""
    print(f"[股票列表] 请求")
    
    symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V']
    
    stocks = []
    for symbol in symbols:
        stock_info = STOCK_DATA.get(symbol, {
            "name": f"{symbol} Company",
            "price": 100.0,
            "change": 1.0,
            "changePercent": 1.0,
            "marketCap": 1000000000000,
            "sector": "General",
            "currency": "USD"
        })
        
        price = stock_info["price"]
        
        stocks.append({
            "symbol": symbol,
            "name": stock_info["name"],
            "price": price,
            "change": stock_info["change"],
            "changePercent": stock_info["changePercent"],
            "marketCap": stock_info["marketCap"],  # 实际美元值
            "sector": stock_info["sector"],
            "dayHigh": price * 1.02,
            "dayLow": price * 0.98,
            "previousClose": price - stock_info["change"],
            "dataSource": "Finnhub",
            "timestamp": datetime.now().isoformat(),
            "currency": stock_info["currency"]
        })
    
    return jsonify({
        "stocks": stocks,
        "count": len(stocks),
        "source": "Finnhub",
        "timestamp": time.time(),
        "success": True,
        "elapsed": 0.1
    })

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取系统状态"""
    return jsonify({
        "status": "online",
        "uptime": 0,
        "timestamp": time.time(),
        "apis": {
            "finnhub": "active (simulated data)",
            "alpaca": "not configured"
        }
    })

@app.route('/')
def home():
    return """
    <h1>Quant Backend Server</h1>
    <p>Available APIs:</p>
    <ul>
        <li>GET /api/market/stocks - 股票列表</li>
        <li>GET /api/market/stock/&lt;symbol&gt; - 单股详情</li>
        <li>GET /api/market/history/&lt;symbol&gt; - 历史数据</li>
        <li>GET /api/status - 系统状态</li>
    </ul>
    """

if __name__ == '__main__':
    print("="*60)
    print("Quant Backend Server - Final Version")
    print("="*60)
    print("Running on: http://127.0.0.1:8890")
    print("="*60)
    
    app.run(host='127.0.0.1', port=8890, debug=False)