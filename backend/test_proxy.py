#!/usr/bin/env python3
"""
测试代理配置
"""

from flask import Flask, jsonify, request
import time

app = Flask(__name__)

# 添加详细的请求日志
@app.before_request
def log_request_info():
    print(f"\n{'='*60}")
    print(f"[{time.strftime('%H:%M:%S')}] 收到请求")
    print(f"  方法: {request.method}")
    print(f"  路径: {request.path}")
    print(f"  完整URL: {request.url}")
    print(f"  参数: {request.args.to_dict()}")
    print(f"  头部: {{k: v for k, v in request.headers if k.startswith('X-')}}")
    print(f"{'='*60}")

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    print(f"[处理] 历史数据请求: {symbol}")
    return jsonify({
        "symbol": symbol.upper(),
        "interval": request.args.get('interval', 'D'),
        "range": request.args.get('range', '1month'),
        "data": [
            {
                "timestamp": int(time.time()) - 86400 * i,
                "time": time.strftime('%Y-%m-%dT%H:%M:%S', time.localtime(time.time() - 86400 * i)),
                "open": 100.0 + i,
                "high": 105.0 + i,
                "low": 95.0 + i,
                "close": 102.0 + i,
                "volume": 1000000 + i * 10000
            }
            for i in range(20, 0, -1)
        ],
        "count": 20,
        "dataSource": "Finnhub (测试)",
        "timestamp": time.time()
    })

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_data(symbol):
    print(f"[处理] 单股详情请求: {symbol}")
    return jsonify({
        "symbol": symbol.upper(),
        "name": f"{symbol.upper()} Company",
        "price": 150.25,
        "change": 2.5,
        "changePercent": 1.69,
        "marketCap": 2500000000000,  # 2.5万亿
        "sector": "Technology",
        "dayHigh": 152.0,
        "dayLow": 148.5,
        "previousClose": 147.75,
        "dataSource": "Finnhub",
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%S'),
        "currency": "USD"
    })

@app.route('/api/status', methods=['GET'])
def get_status():
    return jsonify({
        "status": "online",
        "timestamp": time.time(),
        "apis": ["market/history", "market/stock", "status"]
    })

@app.route('/')
def home():
    return "Backend Server is running. Available endpoints: /api/market/history/<symbol>, /api/market/stock/<symbol>, /api/status"

if __name__ == '__main__':
    print("="*60)
    print("启动测试后端服务器 (带详细日志)")
    print("="*60)
    print("可用接口:")
    print("  1. GET /api/market/history/<symbol> - 历史数据")
    print("  2. GET /api/market/stock/<symbol> - 单股详情")
    print("  3. GET /api/status - 系统状态")
    print("="*60)
    print("服务器URL: http://127.0.0.1:8889")
    print("="*60)
    print("等待请求...")
    
    app.run(host='127.0.0.1', port=8889, debug=False)