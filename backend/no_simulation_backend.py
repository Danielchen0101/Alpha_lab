#!/usr/bin/env python3
"""
No Simulation Backend - 不生成模拟历史数据
如果拿不到真实历史数据，就返回空数据
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import time
from datetime import datetime, timedelta
import requests

app = Flask(__name__)
CORS(app)

# Finnhub API配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

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

def get_real_time_quote(symbol):
    """获取实时报价"""
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
                'timestamp': int(time.time())
            }
    except:
        pass
    
    return None

def try_get_real_historical_data(symbol, interval, range_param):
    """尝试获取真实历史数据"""
    print(f"  尝试获取真实Finnhub历史数据...")
    
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
        
        print(f"  请求Finnhub历史数据API...")
        response = requests.get(url, params=params, timeout=10)
        
        print(f"  Finnhub响应状态: {response.status_code}")
        
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
                
                # 按时间升序排序
                formatted_data.sort(key=lambda x: x['timestamp'])
                
                print(f"  成功获取 {len(formatted_data)} 条真实历史数据")
                return formatted_data, True
            else:
                print(f"  Finnhub数据错误: {data.get('s')}")
                return [], False
        else:
            print(f"  Finnhub API错误: {response.status_code}")
            return [], False
            
    except Exception as e:
        print(f"  获取真实历史数据异常: {e}")
        return [], False

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取股票历史价格数据 - 只返回真实数据或空数据"""
    print(f"\n{'='*80}")
    print(f"[历史数据请求] 真实数据模式")
    print(f"  符号: {symbol}")
    print(f"  参数: interval={request.args.get('interval', 'D')}, range={request.args.get('range', '1month')}")
    
    interval = request.args.get('interval', 'D')
    range_param = request.args.get('range', '1month')
    
    # 尝试获取真实历史数据
    real_data, success = try_get_real_historical_data(symbol, interval, range_param)
    
    if success and real_data:
        # 成功获取真实数据
        closes = [d['close'] for d in real_data]
        print(f"  返回真实历史数据: {len(real_data)}条")
        print(f"  价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
        print(f"  最后收盘价: ${closes[-1]:.2f}")
        
        return jsonify({
            "symbol": symbol.upper(),
            "interval": interval,
            "range": range_param,
            "data": real_data,
            "count": len(real_data),
            "dataSource": "Finnhub (真实历史数据)",
            "timestamp": time.time(),
            "isRealData": True,
            "note": "真实历史candles数据"
        })
    else:
        # 无法获取真实数据，返回空数据
        print(f"  无法获取真实历史数据，返回空数据")
        
        return jsonify({
            "symbol": symbol.upper(),
            "interval": interval,
            "range": range_param,
            "data": [],
            "count": 0,
            "dataSource": "数据不可用",
            "timestamp": time.time(),
            "isRealData": False,
            "error": "无法获取真实历史数据。Finnhub免费套餐不支持历史数据API。",
            "note": "历史数据不可用，请升级API套餐或使用其他数据源。",
            "suggestion": "前端应显示 'No historical data available'"
        })

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_data(symbol):
    """获取单个股票数据 - 使用真实报价"""
    print(f"[单股详情] 请求: {symbol}")
    
    symbol_upper = symbol.upper()
    info = STOCK_INFO_DB.get(symbol_upper, {
        'name': f'{symbol_upper} Company',
        'sector': 'General',
        'marketCap': 1000000000000,
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
    
    symbols = request.args.get('symbols', '')
    if symbols:
        symbol_list = [s.strip().upper() for s in symbols.split(',') if s.strip()]
    else:
        symbol_list = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL']
    
    stocks_data = []
    
    for symbol in symbol_list:
        info = STOCK_INFO_DB.get(symbol, {
            'name': f'{symbol} Company',
            'sector': 'General',
            'marketCap': 1000000000000,
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
        "dataSource": "实时报价 + 无模拟历史",
        "note": "历史数据API: Finnhub免费套餐不支持，返回空数据"
    })

if __name__ == '__main__':
    print("="*80)
    print("No Simulation Backend Server")
    print("="*80)
    print("原则: 不生成模拟历史数据")
    print("规则:")
    print("  1. 尝试获取真实Finnhub历史数据")
    print("  2. 如果失败，返回空数据")
    print("  3. 前端应显示 'No historical data available'")
    print("  4. 不再生成'看起来像真的模拟图'")
    print("="*80)
    print("Finnhub历史数据API状态: 免费套餐不支持 (返回403)")
    print("实时报价API: 工作正常")
    print("="*80)
    print("Running on: http://127.0.0.1:8890")
    print("="*80)
    app.run(host='127.0.0.1', port=8890, debug=False)