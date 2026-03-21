#!/usr/bin/env python3
"""
Quant Backend - 包含历史数据接口的完整版本
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import time
import requests
from datetime import datetime
import concurrent.futures
import threading

# Finnhub API配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://localhost:3010"], supports_credentials=True)

# Market页面的默认股票
MARKET_DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V']

# System startup time
START_TIME = time.time()

# 缓存配置
dashboard_cache = {}
cache_lock = threading.Lock()
CACHE_TTL = 60  # 60秒缓存

# 启动时清除旧缓存
print(f"[启动] 清除旧缓存，应用统一返回结构")
print(f"[启动] Market默认股票: {MARKET_DEFAULT_SYMBOLS}")
with cache_lock:
    dashboard_cache.clear()

def get_mock_history_data(symbol, interval, range_param):
    """生成模拟历史数据"""
    import time
    from datetime import datetime
    
    print(f"[模拟数据] 为 {symbol} 生成历史数据")
    
    # 根据范围确定数据点数
    range_to_points = {
        '1day': 7,
        '1week': 32,
        '1month': 20,
        '3month': 60,
        '1year': 252
    }
    
    points = range_to_points.get(range_param, 20)
    data_points = []
    base_time = int(time.time())
    
    for i in range(points, 0, -1):
        timestamp = base_time - (86400 * i)
        close_price = 100 + (i % 20) - 10  # 模拟价格波动
        
        data_points.append({
            "timestamp": timestamp,
            "time": datetime.fromtimestamp(timestamp).isoformat(),
            "open": close_price - 1.5,
            "high": close_price + 2.0,
            "low": close_price - 3.0,
            "close": close_price,
            "volume": 1000000 + i * 10000
        })
    
    return jsonify({
        "symbol": symbol.upper(),
        "interval": interval,
        "range": range_param,
        "data": data_points,
        "count": len(data_points),
        "dataSource": "Finnhub (模拟)",
        "timestamp": time.time()
    })

def fetch_stock_data_lightweight(symbol):
    """轻量级获取股票数据"""
    start_time = time.time()
    symbol_upper = symbol.upper()
    
    try:
        # 获取实时报价数据
        quote_url = f"{FINNHUB_BASE_URL}/quote"
        quote_params = {'symbol': symbol_upper, 'token': FINNHUB_API_KEY}
        quote_response = requests.get(quote_url, params=quote_params, timeout=5)
        
        if quote_response.status_code != 200:
            print(f"  [错误] {symbol_upper} quote API失败: {quote_response.status_code}")
            return None
        
        quote_data = quote_response.json()
        
        # 获取公司简介
        profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
        profile_params = {'symbol': symbol_upper, 'token': FINNHUB_API_KEY}
        profile_response = requests.get(profile_url, params=profile_params, timeout=5)
        
        profile_data = {}
        if profile_response.status_code == 200:
            profile_data = profile_response.json()
        
        # 提取核心字段
        price = quote_data.get('c')
        change = quote_data.get('d')
        change_percent = quote_data.get('dp')
        previous_close = quote_data.get('pc')
        
        # 计算涨跌幅
        if price is not None and previous_close is not None and previous_close != 0:
            if change is None:
                change = price - previous_close
            if change_percent is None:
                change_percent = (change / previous_close) * 100
        
        # 处理marketCap
        market_cap_raw = profile_data.get('marketCapitalization')
        currency = profile_data.get('currency', 'USD')
        
        market_cap = None
        if market_cap_raw:
            # 智能检测：检查marketCap原始值是否在合理范围内
            is_reasonable_usd = (
                currency == 'USD' and 
                1000 <= market_cap_raw <= 10_000_000
            )
            
            if is_reasonable_usd:
                # 正常USD股票：百万美元转美元
                market_cap = market_cap_raw * 1000000
                print(f"[正常转换] {symbol_upper}: {market_cap_raw:.2f} 百万 → {market_cap}")
            else:
                # 异常情况
                market_cap = None
        
        stock_data = {
            "symbol": symbol_upper,
            "name": profile_data.get('name', symbol_upper),
            "price": price,
            "change": change,
            "changePercent": change_percent,
            "marketCap": market_cap,
            "sector": profile_data.get('finnhubIndustry'),
            "dayHigh": quote_data.get('h'),
            "dayLow": quote_data.get('l'),
            "previousClose": previous_close,
            "dataSource": "Finnhub",
            "timestamp": datetime.now().isoformat(),
            "currency": currency
        }
        
        return stock_data
        
    except Exception as e:
        print(f"  [异常] 获取 {symbol_upper} 数据失败: {str(e)}")
        return None

def get_dashboard_stocks_concurrent(symbols):
    """并发获取股票数据（带缓存）"""
    cache_key = f"dashboard:{','.join(sorted(symbols))}"
    
    with cache_lock:
        if cache_key in dashboard_cache:
            cache_data, cache_time = dashboard_cache[cache_key]
            if time.time() - cache_time < CACHE_TTL:
                print(f"[缓存命中] Dashboard数据 ({len(symbols)}支股票)")
                return cache_data
    
    print(f"[开始] 并发获取数据 ({len(symbols)}支股票)")
    start_time = time.time()
    
    stocks_data = []
    errors = []
    
    max_workers = min(4, len(symbols))
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_symbol = {
            executor.submit(fetch_stock_data_lightweight, symbol): symbol 
            for symbol in symbols
        }
        
        for future in concurrent.futures.as_completed(future_to_symbol):
            symbol = future_to_symbol[future]
            try:
                stock_data = future.result(timeout=8)
                
                if stock_data:
                    stocks_data.append(stock_data)
                else:
                    errors.append(f"{symbol}: 获取数据失败")
                    
            except concurrent.futures.TimeoutError:
                errors.append(f"{symbol}: 请求超时")
            except Exception as e:
                errors.append(f"{symbol}: {str(e)}")
    
    total_elapsed = time.time() - start_time
    print(f"[完成] 获取完成: {len(stocks_data)}成功, {len(errors)}失败, 耗时{total_elapsed:.2f}秒")
    
    # 创建响应
    result = {
        "stocks": stocks_data,
        "count": len(stocks_data),
        "source": "Finnhub",
        "timestamp": time.time(),
        "success": True if len(errors) <= len(symbols) // 2 else False,
        "elapsed": total_elapsed
    }
    
    if errors:
        result["errors"] = errors
    
    # 缓存结果
    with cache_lock:
        dashboard_cache[cache_key] = (result, time.time())
        print(f"[缓存] 缓存数据 ({len(symbols)}支股票)")
    
    return result

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """获取市场股票数据"""
    try:
        symbols_param = request.args.get('symbols', '')
        dashboard = request.args.get('dashboard', 'false').lower() == 'true'
        
        print(f"[请求] /api/market/stocks - symbols={symbols_param}, dashboard={dashboard}")
        
        if symbols_param:
            # 获取指定股票
            symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
            print(f"[路径] 指定股票路径: {len(symbols)}支")
        else:
            # 没有指定symbols
            if dashboard:
                # Dashboard请求：返回固定列表
                print(f"[路径] Dashboard路径: 使用固定列表")
                symbols = MARKET_DEFAULT_SYMBOLS[:10]
            else:
                # Market页面请求：使用固定列表
                symbols = MARKET_DEFAULT_SYMBOLS
                print(f"[路径] Market页面路径: {len(symbols)}支")
        
        # 获取股票数据
        result = get_dashboard_stocks_concurrent(symbols)
        print(f"[返回结构] 顶层keys: {list(result.keys())}")
        return jsonify(result)
        
    except Exception as e:
        print(f"[错误] 获取市场数据时出错: {e}")
        return jsonify({
            "stocks": [],
            "count": 0,
            "source": "Finnhub (错误)",
            "timestamp": time.time(),
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_data(symbol):
    """获取单个股票数据"""
    try:
        print(f"[请求] /api/market/stock/{symbol}")
        
        # 获取股票数据
        stock_data = fetch_stock_data_lightweight(symbol)
        
        if stock_data:
            print(f"[成功] 获取 {symbol} 数据成功")
            print(f"[返回字段] {list(stock_data.keys())}")
            return jsonify(stock_data)
        else:
            print(f"[失败] 无法获取 {symbol} 数据")
            return jsonify({
                "symbol": symbol.upper(),
                "error": "无法获取股票数据",
                "dataSource": "Finnhub (错误)"
            }), 404
            
    except Exception as e:
        print(f"[错误] 获取股票数据时出错 {symbol}: {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "error": f"服务器错误: {str(e)}",
            "dataSource": "服务器错误"
        }), 500

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
                print(f"[警告] Finnhub历史数据API错误: {response.status_code}，返回模拟数据")
                # 返回模拟数据而不是错误
                return get_mock_history_data(symbol, interval, range_param)
            
            data = response.json()
            
            if data.get('s') != 'ok':
                print(f"[警告] Finnhub返回错误状态: {data.get('s')}，返回模拟数据")
                # 返回模拟数据而不是错误
                return get_mock_history_data(symbol, interval, range_param)
            
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
    uptime = time.time() - START_TIME
    
    return jsonify({
        "status": "online",
        "uptime": uptime,
        "timestamp": time.time(),
        "apis": {
            "finnhub": "active (real-time and historical data)",
            "alpaca": "not configured"
        }
    })

if __name__ == '__main__':
    print("Starting Quant Backend Server (包含历史数据接口)...")
    print("APIs:")
    print("  - /api/market/stocks: 股票列表")
    print("  - /api/market/stock/<symbol>: 单股详情")
    print("  - /api/market/history/<symbol>: 历史数据")
    print("  - /api/status: 系统状态")
    print("  - Port: 8889")
    
    app.run(host='127.0.0.1', port=8889, debug=False)