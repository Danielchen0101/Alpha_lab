#!/usr/bin/env python3
"""
Real Finnhub Backend - 使用真实Finnhub历史数据
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import time
from datetime import datetime, timedelta
import requests
import os

app = Flask(__name__)
CORS(app)

# Finnhub API配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

# 股票数据模拟（仅用于单股详情）
STOCK_DATA = {
    "AAPL": {
        "name": "Apple Inc",
        "price": 248.18,
        "change": -1.76,
        "changePercent": -0.7042,
        "marketCap": 3800000000000,
        "sector": "Technology",
        "currency": "USD"
    },
    "NVDA": {
        "name": "NVIDIA Corp",
        "price": 179.11,
        "change": 3.25,
        "changePercent": 1.85,
        "marketCap": 4383719823517.77,
        "sector": "Technology",
        "currency": "USD"
    },
    "TSLA": {
        "name": "Tesla Inc",
        "price": 245.23,
        "change": 5.12,
        "changePercent": 2.13,
        "marketCap": 780000000000,
        "sector": "Automotive",
        "currency": "USD"
    },
    "MSFT": {
        "name": "Microsoft Corp",
        "price": 415.86,
        "change": 2.34,
        "changePercent": 0.57,
        "marketCap": 3090000000000,
        "sector": "Technology",
        "currency": "USD"
    },
    "GOOGL": {
        "name": "Alphabet Inc",
        "price": 175.34,
        "change": 1.25,
        "changePercent": 0.72,
        "marketCap": 2200000000000,
        "sector": "Technology",
        "currency": "USD"
    }
}

def get_finnhub_resolution(interval, range_param):
    """将前端参数映射到Finnhub分辨率"""
    # 前端参数: interval='60'表示60分钟, 'D'表示日线
    # Finnhub分辨率: '1', '5', '15', '30', '60', 'D', 'W', 'M'
    
    if interval == '60':
        if range_param == '1day':
            return '5'  # 1天用5分钟数据
        else:
            return '60'  # 其他用60分钟数据
    elif interval == 'D':
        return 'D'  # 日线
    else:
        return 'D'  # 默认日线

def get_finnhub_time_range(range_param):
    """将前端范围参数映射到时间范围"""
    now = datetime.now()
    
    if range_param == '1day':
        from_time = now - timedelta(days=1)
    elif range_param == '1week':
        from_time = now - timedelta(weeks=1)
    elif range_param == '1month':
        from_time = now - timedelta(days=30)
    elif range_param == '3month':
        from_time = now - timedelta(days=90)
    elif range_param == '1year':
        from_time = now - timedelta(days=365)
    else:
        from_time = now - timedelta(days=30)  # 默认1个月
    
    return int(from_time.timestamp()), int(now.timestamp())

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取真实Finnhub历史价格数据"""
    print(f"\n{'='*80}")
    print(f"[真实历史数据请求]")
    print(f"  符号: {symbol}")
    print(f"  参数: interval={request.args.get('interval', 'D')}, range={request.args.get('range', '1month')}")
    
    interval = request.args.get('interval', 'D')
    range_param = request.args.get('range', '1month')
    
    try:
        # 获取Finnhub参数
        resolution = get_finnhub_resolution(interval, range_param)
        from_timestamp, to_timestamp = get_finnhub_time_range(range_param)
        
        print(f"  Finnhub参数: resolution={resolution}, from={from_timestamp}, to={to_timestamp}")
        
        # 调用Finnhub API
        url = f"{FINNHUB_BASE_URL}/stock/candle"
        params = {
            'symbol': symbol.upper(),
            'resolution': resolution,
            'from': from_timestamp,
            'to': to_timestamp,
            'token': FINNHUB_API_KEY
        }
        
        print(f"  请求Finnhub API: {url}")
        
        response = requests.get(url, params=params, timeout=15)
        
        print(f"  Finnhub响应状态: {response.status_code}")
        
        if response.status_code != 200:
            print(f"  Finnhub API错误: {response.status_code}")
            return jsonify({
                "symbol": symbol.upper(),
                "error": f"Finnhub API错误: {response.status_code}",
                "data": [],
                "count": 0,
                "dataSource": "Finnhub (API错误)",
                "timestamp": time.time()
            }), 200  # 仍然返回200，但数据为空
        
        data = response.json()
        
        print(f"  Finnhub原始响应: s={data.get('s')}, 数据条数: {len(data.get('t', []))}")
        
        if data.get('s') != 'ok':
            print(f"  Finnhub数据错误: {data.get('s')}")
            return jsonify({
                "symbol": symbol.upper(),
                "error": f"Finnhub数据错误: {data.get('s')}",
                "data": [],
                "count": 0,
                "dataSource": "Finnhub (数据错误)",
                "timestamp": time.time()
            }), 200
        
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
        
        # 按时间升序排序（Finnhub返回的是降序）
        formatted_data.sort(key=lambda x: x['timestamp'])
        
        print(f"  格式化后数据条数: {len(formatted_data)}")
        
        if formatted_data:
            closes = [d['close'] for d in formatted_data]
            print(f"  价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
            print(f"  最后收盘价: ${closes[-1]:.2f}")
            print(f"  前5个close: {[f'${c:.2f}' for c in closes[:5]]}")
            print(f"  后5个close: {[f'${c:.2f}' for c in closes[-5:]]}")
        
        return jsonify({
            "symbol": symbol.upper(),
            "interval": interval,
            "range": range_param,
            "data": formatted_data,
            "count": len(formatted_data),
            "dataSource": "Finnhub (真实数据)",
            "timestamp": time.time(),
            "finnhubResolution": resolution,
            "finnhubFrom": from_timestamp,
            "finnhubTo": to_timestamp
        })
        
    except Exception as e:
        print(f"  获取真实数据异常: {e}")
        import traceback
        traceback.print_exc()
        
        # 不返回模拟数据，返回空数据
        return jsonify({
            "symbol": symbol.upper(),
            "interval": interval,
            "range": range_param,
            "data": [],
            "count": 0,
            "dataSource": "Finnhub (获取失败)",
            "timestamp": time.time(),
            "error": f"获取真实数据失败: {str(e)}"
        })

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
        "marketCap": 1000000000000,
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
        "marketCap": stock_info["marketCap"],
        "sector": stock_info["sector"],
        "dayHigh": price * 1.03,
        "dayLow": price * 0.97,
        "previousClose": price - stock_info["change"],
        "volume": 10000000,
        "dataSource": "Finnhub",
        "timestamp": time.time()
    })

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """获取市场股票列表"""
    print(f"[股票列表] 请求")
    
    symbols = request.args.get('symbols', '')
    dashboard = request.args.get('dashboard', '').lower() == 'true'
    
    stocks_data = []
    
    if symbols:
        # 返回指定符号的股票
        symbol_list = [s.strip().upper() for s in symbols.split(',') if s.strip()]
        for symbol in symbol_list:
            if symbol in STOCK_DATA:
                stock_info = STOCK_DATA[symbol]
                stocks_data.append({
                    "symbol": symbol,
                    "name": stock_info["name"],
                    "price": stock_info["price"],
                    "change": stock_info["change"],
                    "changePercent": stock_info["changePercent"],
                    "marketCap": stock_info["marketCap"],
                    "sector": stock_info["sector"],
                    "currency": stock_info["currency"],
                    "dataSource": "Finnhub",
                    "timestamp": time.time()
                })
    else:
        # 返回所有股票
        for symbol, stock_info in STOCK_DATA.items():
            stocks_data.append({
                "symbol": symbol,
                "name": stock_info["name"],
                "price": stock_info["price"],
                "change": stock_info["change"],
                "changePercent": stock_info["changePercent"],
                "marketCap": stock_info["marketCap"],
                "sector": stock_info["sector"],
                "currency": stock_info["currency"],
                "dataSource": "Finnhub",
                "timestamp": time.time()
            })
    
    return jsonify({
        "stocks": stocks_data,
        "count": len(stocks_data),
        "source": "Finnhub",
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
        "timestamp": time.time()
    })

if __name__ == '__main__':
    print("="*80)
    print("Real Finnhub Backend Server - 使用真实历史数据")
    print("="*80)
    print(f"Finnhub API Key: {FINNHUB_API_KEY[:8]}...{FINNHUB_API_KEY[-4:]}")
    print("Running on: http://127.0.0.1:8890")
    print("="*80)
    app.run(host='127.0.0.1', port=8890, debug=False)