#!/usr/bin/env python3
"""
Dashboard优化方案
1. 减少股票数量（8支）
2. 轻量级模式（只获取核心字段）
3. 并发请求
4. 添加缓存
"""

import time
import requests
import concurrent.futures
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
import threading

app = Flask(__name__)
CORS(app)

# Finnhub API配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

# 热门股票（8支核心股票）
POPULAR_STOCKS = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM"]

# 缓存配置
cache = {}
cache_lock = threading.Lock()
CACHE_TTL = 60  # 60秒缓存

def fetch_stock_data_lightweight(symbol):
    """轻量级获取股票数据（只获取核心字段）"""
    start_time = time.time()
    symbol_upper = symbol.upper()
    
    print(f"  [开始] 获取 {symbol_upper} 数据")
    
    try:
        # 1. 获取实时报价数据（核心）
        quote_start = time.time()
        quote_url = f"{FINNHUB_BASE_URL}/quote"
        quote_params = {'symbol': symbol_upper, 'token': FINNHUB_API_KEY}
        quote_response = requests.get(quote_url, params=quote_params, timeout=5)
        quote_elapsed = time.time() - quote_start
        
        if quote_response.status_code != 200:
            print(f"  [错误] {symbol_upper} quote API失败: {quote_response.status_code}")
            return None
        
        quote_data = quote_response.json()
        print(f"  [完成] {symbol_upper} quote: {quote_elapsed:.2f}秒")
        
        # 2. 获取公司简介（用于marketCap和sector）
        profile_start = time.time()
        profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
        profile_params = {'symbol': symbol_upper, 'token': FINNHUB_API_KEY}
        profile_response = requests.get(profile_url, params=profile_params, timeout=5)
        profile_elapsed = time.time() - profile_start
        
        if profile_response.status_code != 200:
            print(f"  [警告] {symbol_upper} profile API失败，使用默认值")
            profile_data = {}
        else:
            profile_data = profile_response.json()
        
        print(f"  [完成] {symbol_upper} profile: {profile_elapsed:.2f}秒")
        
        # 提取核心字段
        price = quote_data.get('c')
        change = quote_data.get('d')
        change_percent = quote_data.get('dp')
        previous_close = quote_data.get('pc')
        
        # 计算涨跌幅（如果API没有提供）
        if price is not None and previous_close is not None and previous_close != 0:
            if change is None:
                change = price - previous_close
            if change_percent is None:
                change_percent = (change / previous_close) * 100
        
        # 处理marketCap（Finnhub单位是百万美元）
        market_cap_raw = profile_data.get('marketCapitalization')
        market_cap = market_cap_raw * 1000000 if market_cap_raw else None
        
        # 构建返回数据（只包含核心字段）
        stock_data = {
            "symbol": symbol_upper,
            "name": profile_data.get('name', symbol_upper),
            "price": price,
            "change": change,
            "changePercent": change_percent,
            "marketCap": market_cap,
            "sector": profile_data.get('finnhubIndustry'),
            "dataSource": "Finnhub",
            "timestamp": datetime.now().isoformat()
        }
        
        total_elapsed = time.time() - start_time
        print(f"  [完成] {symbol_upper} 总计: {total_elapsed:.2f}秒")
        
        return stock_data
        
    except Exception as e:
        print(f"  [异常] 获取 {symbol_upper} 数据失败: {str(e)}")
        return None

def get_dashboard_stocks(symbols):
    """获取Dashboard股票数据（带缓存和并发）"""
    # 检查缓存
    cache_key = f"dashboard:{','.join(sorted(symbols))}"
    
    with cache_lock:
        if cache_key in cache:
            cache_data, cache_time = cache[cache_key]
            if time.time() - cache_time < CACHE_TTL:
                print(f"[缓存命中] Dashboard数据 ({len(symbols)}支股票)")
                return cache_data
    
    print(f"[开始] 获取Dashboard数据 ({len(symbols)}支股票)")
    start_time = time.time()
    
    stocks_data = []
    errors = []
    
    # 使用线程池并发获取
    max_workers = min(4, len(symbols))  # 限制并发数，避免触发速率限制
    
    print(f"[并发] 使用 {max_workers} 个线程并发获取")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 提交所有任务
        future_to_symbol = {
            executor.submit(fetch_stock_data_lightweight, symbol): symbol 
            for symbol in symbols
        }
        
        # 收集结果
        for future in concurrent.futures.as_completed(future_to_symbol):
            symbol = future_to_symbol[future]
            try:
                stock_data = future.result(timeout=8)  # 每只股票最多8秒
                
                if stock_data:
                    stocks_data.append(stock_data)
                else:
                    errors.append(f"{symbol}: 获取数据失败")
                    
            except concurrent.futures.TimeoutError:
                errors.append(f"{symbol}: 请求超时（8秒）")
                print(f"  [超时] {symbol} 请求超时")
            except Exception as e:
                errors.append(f"{symbol}: {str(e)}")
                print(f"  [异常] {symbol}: {str(e)}")
    
    total_elapsed = time.time() - start_time
    print(f"[完成] Dashboard数据获取完成: {len(stocks_data)}成功, {len(errors)}失败, 耗时{total_elapsed:.2f}秒")
    
    result = {
        "stocks": stocks_data,
        "count": len(stocks_data),
        "source": "Finnhub",
        "timestamp": time.time(),
        "success": True,
        "elapsed": total_elapsed
    }
    
    if errors:
        result["errors"] = errors
        result["success"] = False if len(errors) > len(symbols) // 2 else True
    
    # 缓存结果
    with cache_lock:
        cache[cache_key] = (result, time.time())
        print(f"[缓存] 缓存Dashboard数据 ({len(symbols)}支股票)")
    
    return result

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """获取市场股票数据（优化版）"""
    try:
        symbols_param = request.args.get('symbols', '')
        dashboard = request.args.get('dashboard', 'false').lower() == 'true'
        
        if symbols_param:
            # 获取指定股票
            symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
        else:
            # 获取热门股票
            symbols = POPULAR_STOCKS[:8]  # 临时降为8支以保证稳定性
        
        print(f"[请求] 获取股票数据: {len(symbols)}支, dashboard={dashboard}")
        
        # Dashboard请求使用优化版本
        if dashboard:
            result = get_dashboard_stocks(symbols)
            return jsonify(result)
        else:
            # 普通请求（保持原有逻辑）
            stocks_data = []
            for symbol in symbols:
                stock_data = fetch_stock_data_lightweight(symbol)
                if stock_data:
                    stocks_data.append(stock_data)
            
            return jsonify({
                "stocks": stocks_data,
                "count": len(stocks_data),
                "source": "Finnhub",
                "timestamp": time.time(),
                "success": True
            })
        
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

if __name__ == "__main__":
    print("启动优化版Dashboard后端...")
    print(f"股票数量: {len(POPULAR_STOCKS[:8])}支")
    print(f"缓存时间: {CACHE_TTL}秒")
    print(f"并发限制: 最多4个线程")
    app.run(host='127.0.0.1', port=8890, debug=False)