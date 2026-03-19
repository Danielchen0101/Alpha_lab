#!/usr/bin/env python3
"""
Quant Backend - 统一返回结构版本
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

# 候选股票池，用于动态筛选
CANDIDATE_STOCKS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "ADBE", "CRM", "ORCL",
    "INTC", "AMD", "QCOM", "CSCO", "IBM", "TSM", "TSLA", "RIVN", "LCID",
    "NIO", "LI", "XPEV", "JPM", "BAC", "WFC", "C", "GS", "MS", "V", "MA",
    "AXP", "PYPL", "SQ", "JNJ", "UNH", "PFE", "MRK", "ABBV", "LLY", "TMO",
    "DHR", "WMT", "PG", "KO", "PEP", "MCD", "SBUX", "NKE", "HD", "LOW",
    "TGT", "COST", "CAT", "BA", "HON", "GE", "MMM", "XOM", "CVX", "COP",
    "T", "VZ", "CMCSA", "DIS", "NFLX", "PARA", "WBD", "SPG", "PLD", "AMT"
]

# 必须包含的股票
MUST_HAVE_STOCKS = ["AAPL", "TSLA", "NVDA"]

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

def create_unified_response(stocks_data, source="Finnhub", success=True, errors=None, elapsed=0, extra_info=None):
    """创建统一的响应结构"""
    response = {
        "stocks": stocks_data,
        "count": len(stocks_data),
        "source": source,
        "timestamp": time.time(),
        "success": success,
        "elapsed": elapsed
    }
    
    if errors:
        response["errors"] = errors
        
    if extra_info:
        response["extra_info"] = extra_info
        
    return response

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
        
        stock_data = {
            "symbol": symbol_upper,
            "name": profile_data.get('name', symbol_upper),
            "price": price,
            "change": change,
            "changePercent": change_percent,
            "marketCap": None,
            "sector": profile_data.get('finnhubIndustry'),
            "dayHigh": quote_data.get('h'),
            "dayLow": quote_data.get('l'),
            "dataSource": "Finnhub",
            "timestamp": datetime.now().isoformat()
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
                print(f"[缓存结构] 顶层keys: {list(cache_data.keys())}")
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
    
    # 创建统一响应
    result = create_unified_response(
        stocks_data=stocks_data,
        source="Finnhub",
        success=True if len(errors) <= len(symbols) // 2 else False,
        errors=errors if errors else None,
        elapsed=total_elapsed
    )
    
    # 缓存结果
    with cache_lock:
        dashboard_cache[cache_key] = (result, time.time())
        print(f"[缓存] 缓存数据 ({len(symbols)}支股票)")
    
    return result

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """获取市场股票数据（统一结构版本）"""
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
                # Dashboard请求：返回固定列表（简化处理）
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
        # 异常路径也返回统一结构
        error_response = create_unified_response(
            stocks_data=[],
            source="Finnhub (错误)",
            success=False,
            errors=[f"服务器错误: {str(e)}"],
            elapsed=0
        )
        print(f"[返回结构] 错误路径顶层keys: {list(error_response.keys())}")
        return jsonify(error_response), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取系统状态"""
    uptime = time.time() - START_TIME
    
    return jsonify({
        "status": "online",
        "uptime": uptime,
        "timestamp": time.time(),
        "apis": {
            "finnhub": "active (real-time data)",
            "alpaca": "not configured"
        }
    })

if __name__ == '__main__':
    print("Starting Quant Backend Server (统一结构版本)...")
    print("APIs:")
    print("  - /api/market/stocks: 统一返回结构")
    print("  - /api/status: 系统状态")
    print("  - Port: 8889")
    
    app.run(host='127.0.0.1', port=8889, debug=False)