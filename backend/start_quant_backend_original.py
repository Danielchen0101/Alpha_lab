"""
修复版后端 - 包含market cap修复
"""
from flask import Flask, request, jsonify
import requests
import time
import traceback

app = Flask(__name__)

# ==================== 配置 ====================
TWELVEDATA_API_KEY = '4c486f3044124045a3bb48c1b6bc0a1b'
FINNHUB_API_KEY = 'd6v2q09r01qig546aus0d6v2q09r01qig546ausg'

# ==================== 工具函数 ====================
def safe_float(value, default=0.0):
    """安全转换为float"""
    try:
        return float(value)
    except (ValueError, TypeError):
        return float(default)

# ==================== Finnhub API ====================
def get_finnhub_quote_simple(symbol):
    """
    从Finnhub获取股票实时报价
    """
    print(f"[Finnhub] 获取股票报价: {symbol}")
    
    try:
        url = "https://finnhub.io/api/v1/quote"
        params = {
            'symbol': symbol.upper(),
            'token': FINNHUB_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            print(f"[Finnhub] {symbol}: HTTP错误 {response.status_code}")
            return None, f"HTTP错误: {response.status_code}"
        
        data = response.json()
        
        # 检查是否有错误
        if 'error' in data:
            error_msg = data.get('error', '未知错误')
            print(f"[Finnhub] {symbol}: API错误 {error_msg}")
            return None, error_msg
        
        # 检查数据是否有效（价格不为0）
        if data.get('c', 0) == 0:
            print(f"[Finnhub] {symbol}: 价格数据为0")
            return None, "价格数据为0"
        
        print(f"[Finnhub] {symbol}: 成功获取报价数据")
        return data, None
        
    except Exception as e:
        print(f"[Finnhub] {symbol}: 异常 {e}")
        return None, str(e)

def get_finnhub_profile_simple(symbol):
    """
    从Finnhub获取股票profile信息（包含市值）
    """
    print(f"[Finnhub] 获取股票profile: {symbol}")
    
    try:
        url = "https://finnhub.io/api/v1/stock/profile2"
        params = {
            'symbol': symbol.upper(),
            'token': FINNHUB_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            print(f"[Finnhub] {symbol}: profile HTTP错误 {response.status_code}")
            return None, f"HTTP错误: {response.status_code}"
        
        data = response.json()
        
        # 检查是否有错误
        if 'error' in data:
            error_msg = data.get('error', '未知错误')
            print(f"[Finnhub] {symbol}: profile API错误 {error_msg}")
            return None, error_msg
        
        # 检查是否返回空对象
        if not data or len(data) == 0:
            print(f"[Finnhub] {symbol}: profile 空响应")
            return None, "空响应"
        
        print(f"[Finnhub] {symbol}: 成功获取profile数据")
        return data, None
        
    except Exception as e:
        print(f"[Finnhub] {symbol}: profile 异常 {e}")
        return None, str(e)

# ==================== 主要API ====================
@app.route('/market/stocks', methods=['GET'])
@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """股票列表接口 - 包含market cap修复"""
    print(f"\n[API] ========== /api/market/stocks 被调用 (market cap修复版) ==========")
    
    try:
        # 获取参数
        symbols_param = request.args.get('symbols', '')
        
        # 默认股票列表
        DEFAULT_SYMBOLS = ['AAPL', 'TSLA', 'AMD', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'INTC']
        
        # 确定股票列表
        if symbols_param:
            symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
        else:
            symbols = DEFAULT_SYMBOLS
        
        print(f"[API] 获取 {len(symbols)} 支股票数据")
        
        # 股票名称映射
        STOCK_NAMES = {
            'AAPL': 'Apple Inc.',
            'MSFT': 'Microsoft Corporation',
            'GOOGL': 'Alphabet Inc.',
            'AMZN': 'Amazon.com Inc.',
            'TSLA': 'Tesla Inc.',
            'NVDA': 'NVIDIA Corporation',
            'META': 'Meta Platforms Inc.',
            'NFLX': 'Netflix Inc.',
            'AMD': 'Advanced Micro Devices Inc.',
            'INTC': 'Intel Corporation'
        }
        
        # 股票行业映射
        STOCK_SECTORS = {
            'AAPL': 'Technology',
            'MSFT': 'Technology',
            'GOOGL': 'Communication Services',
            'AMZN': 'Consumer Cyclical',
            'TSLA': 'Consumer Cyclical',
            'NVDA': 'Technology',
            'META': 'Communication Services',
            'NFLX': 'Communication Services',
            'AMD': 'Technology',
            'INTC': 'Technology'
        }
        
        # 获取数据
        stocks = []
        success_count = 0
        
        for symbol in symbols:
            try:
                print(f"[API] 处理股票: {symbol}")
                
                # 获取报价数据
                quote_data, quote_error = get_finnhub_quote_simple(symbol)
                
                if quote_error or not quote_data:
                    print(f"[API] {symbol}: 获取报价失败")
                    stock_data = {
                        "symbol": symbol.upper(),
                        "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),
                        "price": None,
                        "change": None,
                        "changePercent": None,
                        "open": None,
                        "dayHigh": None,
                        "dayLow": None,
                        "volume": None,
                        "marketCap": None,
                        "currency": "USD",
                        "exchange": "NASDAQ",
                        "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),
                        "sector": STOCK_SECTORS.get(symbol.upper(), "Technology"),
                        "previousClose": None,
                        "dataSource": "Finnhub (API错误)",
                        "timestamp": int(time.time()),
                        "error": quote_error or "未获取到数据"
                    }
                else:
                    # 解析数据
                    current_price = safe_float(quote_data.get('c'), 0)
                    change_amount = safe_float(quote_data.get('d'), 0)
                    change_percent = safe_float(quote_data.get('dp'), 0)
                    day_high = safe_float(quote_data.get('h'), 0)
                    day_low = safe_float(quote_data.get('l'), 0)
                    open_price = safe_float(quote_data.get('o'), 0)
                    previous_close = safe_float(quote_data.get('pc'), 0)
                    
                    # 获取profile信息（包含市值）
                    import sys
                    print(f"[API强制输出] {symbol}: 开始获取profile数据", file=sys.stderr)
                    sys.stderr.flush()
                    
                    profile_data, profile_error = get_finnhub_profile_simple(symbol)
                    market_cap = None
                    
                    if profile_error:
                        print(f"[API] {symbol}: 获取profile失败 - {profile_error}")
                    elif not profile_data:
                        print(f"[API] {symbol}: profile数据为空")
                    else:
                        # Finnhub返回的marketCapitalization单位是百万（million）
                        # 例如：3640775.919598978 表示 3.64万亿（3640775.92百万美元）
                        raw_market_cap = safe_float(profile_data.get('marketCapitalization'), 0)
                        print(f"[API] {symbol}: 原始市值数据: {raw_market_cap}")
                        
                        if raw_market_cap > 0:
                            # 转换为正确的数值：百万 -> 实际数值
                            market_cap = raw_market_cap * 1000000  # 百万转换为实际数值
                            print(f"[API] {symbol}: 获取到市值 {raw_market_cap:.2f}M = {market_cap:.0f}美元")
                        else:
                            print(f"[API] {symbol}: 市值数据为0或无效")
                    
                    stock_data = {
                        "symbol": symbol.upper(),
                        "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),
                        "price": current_price if current_price > 0 else None,
                        "change": change_amount,
                        "changePercent": change_percent,
                        "open": open_price if open_price > 0 else None,
                        "dayHigh": day_high if day_high > 0 else None,
                        "dayLow": day_low if day_low > 0 else None,
                        "volume": None,
                        "marketCap": market_cap,
                        "currency": "USD",
                        "exchange": "NASDAQ",
                        "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),
                        "sector": STOCK_SECTORS.get(symbol.upper(), "Technology"),
                        "previousClose": previous_close if previous_close > 0 else None,
                        "dataSource": "Finnhub",
                        "timestamp": int(time.time())
                    }
                    success_count += 1
                    print(f"[API] {symbol}: 成功获取数据 - 价格: ${current_price:.2f}, 市值: {market_cap}")
                
                stocks.append(stock_data)
                
            except Exception as e:
                print(f"[API] {symbol}: 处理异常 - {e}")
                traceback.print_exc()
                stocks.append({
                    "symbol": symbol.upper(),
                    "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),
                    "price": None,
                    "change": None,
                    "changePercent": None,
                    "open": None,
                    "dayHigh": None,
                    "dayLow": None,
                    "volume": None,
                    "marketCap": None,
                    "currency": "USD",
                    "exchange": "NASDAQ",
                    "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),
                    "sector": STOCK_SECTORS.get(symbol.upper(), "Technology"),
                    "previousClose": None,
                    "dataSource": "Finnhub (异常)",
                    "timestamp": int(time.time()),
                    "error": str(e)
                })
        
        print(f"[API] 数据获取完成: 成功 {success_count}, 失败 {len(symbols) - success_count}, 总计 {len(stocks)}")
        
        return jsonify({
            "stocks": stocks,
            "count": len(stocks),
            "dataSource": "Finnhub",
            "successCount": success_count,
            "failedCount": len(symbols) - success_count,
            "timestamp": int(time.time())
        }), 200
        
    except Exception as e:
        print(f"[API] 全局异常: {e}")
        traceback.print_exc()
        return jsonify({
            "stocks": [],
            "count": 0,
            "dataSource": "Finnhub (错误)",
            "error": str(e),
            "timestamp": int(time.time())
        }), 500

# ==================== 其他必要路由 ====================
@app.route('/api/status', methods=['GET'])
@app.route('/status', methods=['GET'])
def get_status():
    """系统状态接口"""
    return jsonify({
        "status": "online",
        "timestamp": int(time.time()),
        "version": "1.0.0-marketcap-fix"
    }), 200

# ==================== 启动 ====================
if __name__ == '__main__':
    print("================================================================================")
    print("修复版后端启动 - 包含market cap修复")
    print("API密钥: 4c486f30...")
    print("端口: 8889")
    print("================================================================================\n")
    
    # 强制刷新输出
    import sys
    sys.stdout.flush()
    sys.stderr.flush()
    
    app.run(host='127.0.0.1', port=8889, debug=True, use_reloader=False)