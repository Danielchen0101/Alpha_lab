"""
优化版后端 - 清理了调试代码，保留核心功能
"""
from flask import Flask, request, jsonify
import requests
import time

app = Flask(__name__)

# API密钥
FINNHUB_API_KEY = 'd6v2q09r01qig546aus0d6v2q09r01qig546ausg'

def safe_float(value, default=0.0):
    """安全转换为float"""
    try:
        return float(value)
    except (ValueError, TypeError):
        return float(default)

def get_finnhub_quote(symbol):
    """获取股票报价"""
    try:
        url = "https://finnhub.io/api/v1/quote"
        params = {'symbol': symbol.upper(), 'token': FINNHUB_API_KEY}
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            return None, f"HTTP错误: {response.status_code}"
        
        data = response.json()
        if 'error' in data:
            return None, data.get('error', '未知错误')
        
        if data.get('c', 0) == 0:
            return None, "价格数据为0"
        
        return data, None
    except Exception as e:
        return None, str(e)

def get_finnhub_profile(symbol):
    """获取股票profile信息（包含市值）"""
    try:
        url = "https://finnhub.io/api/v1/stock/profile2"
        params = {'symbol': symbol.upper(), 'token': FINNHUB_API_KEY}
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            return None, f"HTTP错误: {response.status_code}"
        
        data = response.json()
        if 'error' in data:
            return None, data.get('error', '未知错误')
        
        if not data or len(data) == 0:
            return None, "空响应"
        
        # 检查是否有marketCapitalization字段
        if 'marketCapitalization' not in data:
            return None, "没有marketCapitalization字段"
        
        return data, None
        
    except Exception as e:
        return None, str(e)

@app.route('/market/stocks', methods=['GET'])
@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """股票列表接口 - Dashboard和Market页面使用"""
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
        
        stocks = []
        success_count = 0
        
        for symbol in symbols:
            try:
                # 获取报价数据
                quote_data, quote_error = get_finnhub_quote(symbol)
                
                if quote_error or not quote_data:
                    stock_data = {
                        "symbol": symbol.upper(),
                        "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),
                        "price": None,
                        "change": None,
                        "changePercent": None,
                        "dayHigh": None,
                        "dayLow": None,
                        "open": None,
                        "previousClose": None,
                        "marketCap": None,
                        "currency": "USD",
                        "exchange": "NASDAQ",
                        "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),
                        "sector": STOCK_SECTORS.get(symbol.upper(), "Technology"),
                        "dataSource": "Finnhub (API错误)",
                        "timestamp": int(time.time()),
                        "error": quote_error or "未获取到数据"
                    }
                else:
                    # 解析报价数据 - 包含所有Finnhub字段
                    current_price = safe_float(quote_data.get('c'), 0)
                    change_amount = safe_float(quote_data.get('d'), 0)
                    change_percent = safe_float(quote_data.get('dp'), 0)
                    day_high = safe_float(quote_data.get('h'), 0)      # 当日最高价
                    day_low = safe_float(quote_data.get('l'), 0)       # 当日最低价
                    open_price = safe_float(quote_data.get('o'), 0)    # 开盘价
                    previous_close = safe_float(quote_data.get('pc'), 0) # 前收盘价
                    
                    # 获取profile数据（包含市值）
                    profile_data, profile_error = get_finnhub_profile(symbol)
                    market_cap = None
                    
                    if profile_data and not profile_error:
                        # Finnhub返回的marketCapitalization单位是百万（million）
                        raw_market_cap = safe_float(profile_data.get('marketCapitalization'), 0)
                        if raw_market_cap > 0:
                            # 转换为正确的数值：百万 -> 实际数值
                            market_cap = raw_market_cap * 1000000  # 百万转换为实际数值
                    
                    stock_data = {
                        "symbol": symbol.upper(),
                        "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),
                        "price": current_price if current_price > 0 else None,
                        "change": change_amount,
                        "changePercent": change_percent,
                        "dayHigh": day_high if day_high > 0 else None,
                        "dayLow": day_low if day_low > 0 else None,
                        "open": open_price if open_price > 0 else None,
                        "previousClose": previous_close if previous_close > 0 else None,
                        "marketCap": market_cap,
                        "currency": "USD",
                        "exchange": "NASDAQ",
                        "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),
                        "sector": STOCK_SECTORS.get(symbol.upper(), "Technology"),
                        "dataSource": "Finnhub",
                        "timestamp": int(time.time())
                    }
                    success_count += 1
                
                stocks.append(stock_data)
                
            except Exception as e:
                stocks.append({
                    "symbol": symbol.upper(),
                    "name": STOCK_NAMES.get(symbol.upper(), f"{symbol.upper()} Inc."),
                    "price": None,
                    "change": None,
                    "changePercent": None,
                    "dayHigh": None,
                    "dayLow": None,
                    "open": None,
                    "previousClose": None,
                    "marketCap": None,
                    "currency": "USD",
                    "exchange": "NASDAQ",
                    "industry": STOCK_SECTORS.get(symbol.upper(), "Technology"),
                    "sector": STOCK_SECTORS.get(symbol.upper(), "Technology"),
                    "dataSource": "Finnhub (异常)",
                    "timestamp": int(time.time()),
                    "error": str(e)
                })
        
        return jsonify({
            "stocks": stocks,
            "count": len(stocks),
            "dataSource": "Finnhub",
            "successCount": success_count,
            "failedCount": len(symbols) - success_count,
            "timestamp": int(time.time())
        }), 200
        
    except Exception as e:
        return jsonify({
            "stocks": [],
            "count": 0,
            "dataSource": "Finnhub (错误)",
            "error": str(e),
            "timestamp": int(time.time())
        }), 500

@app.route('/api/status', methods=['GET'])
@app.route('/status', methods=['GET'])
def get_status():
    """系统状态接口"""
    return jsonify({
        "status": "online",
        "timestamp": int(time.time()),
        "version": "1.0.0-optimized"
    }), 200

if __name__ == '__main__':
    print("================================================================================")
    print("优化版后端启动 - 清理了调试代码")
    print("端口: 8889")
    print("================================================================================\n")
    
    app.run(host='127.0.0.1', port=8889, debug=True, use_reloader=False)