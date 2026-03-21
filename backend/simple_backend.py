#!/usr/bin/env python3
"""
Simple Backend - 只包含历史数据接口
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import time
import requests
from datetime import datetime

# Finnhub API配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://localhost:3010"], supports_credentials=True)

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取股票历史价格数据"""
    try:
        interval = request.args.get('interval', 'D')
        range_param = request.args.get('range', '1month')
        
        print(f"[请求] /api/market/history/{symbol} - interval={interval}, range={range_param}")
        
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
        
        print(f"[Finnhub参数] resolution={finnhub_resolution}, from={from_timestamp}, to={to_timestamp}")
        
        try:
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
                print(f"[错误] Finnhub历史数据API错误: {response.status_code}")
                return jsonify({
                    "symbol": symbol.upper(),
                    "error": f"Finnhub API错误: {response.status_code}",
                    "dataSource": "Finnhub (API错误)",
                    "data": [],
                    "interval": interval,
                    "range": range_param
                }), response.status_code
            
            data = response.json()
            
            if data.get('s') != 'ok':
                print(f"[错误] Finnhub返回错误状态: {data.get('s')}")
                return jsonify({
                    "symbol": symbol.upper(),
                    "error": f"Finnhub数据错误: {data.get('s')}",
                    "dataSource": "Finnhub (数据错误)",
                    "data": [],
                    "interval": interval,
                    "range": range_param
                }), 404
            
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
            
            print(f"[成功] 返回数据条数: {len(formatted_data)}")
            
            return jsonify({
                "symbol": symbol.upper(),
                "interval": interval,
                "range": range_param,
                "data": formatted_data,
                "count": len(formatted_data),
                "dataSource": "Finnhub",
                "timestamp": time.time()
            })
                
        except Exception as e:
            print(f"[异常] Finnhub API调用异常: {e}")
            return jsonify({
                "symbol": symbol.upper(),
                "error": f"Finnhub API异常: {str(e)}",
                "dataSource": "Finnhub (异常)",
                "data": [],
                "interval": interval,
                "range": range_param
            }), 500
        
    except Exception as e:
        print(f"[错误] 获取历史数据时出错: {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "error": f"服务器错误: {str(e)}",
            "dataSource": "服务器错误",
            "data": [],
            "interval": interval,
            "range": range_param
        }), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取系统状态"""
    return jsonify({
        "status": "online",
        "timestamp": time.time(),
        "apis": {
            "finnhub": "active (historical data only)",
            "alpaca": "not configured"
        }
    })

if __name__ == '__main__':
    print("Starting Simple Backend Server (历史数据接口)...")
    print("APIs:")
    print("  - /api/market/history/<symbol>: 历史数据")
    print("  - /api/status: 系统状态")
    print("  - Port: 8889")
    
    app.run(host='127.0.0.1', port=8889, debug=False)