"""
最简单的market cap修复版本
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
    import sys
    print(f"[Profile调试] 开始获取 {symbol} 的profile数据", file=sys.stderr)
    sys.stderr.flush()
    
    try:
        url = "https://finnhub.io/api/v1/stock/profile2"
        params = {'symbol': symbol.upper(), 'token': FINNHUB_API_KEY}
        
        print(f"[Profile调试] {symbol}: 调用API", file=sys.stderr)
        sys.stderr.flush()
        
        response = requests.get(url, params=params, timeout=10)
        print(f"[Profile调试] {symbol}: 响应状态 {response.status_code}", file=sys.stderr)
        sys.stderr.flush()
        
        if response.status_code != 200:
            print(f"[Profile调试] {symbol}: HTTP错误 {response.status_code}", file=sys.stderr)
            sys.stderr.flush()
            return None, f"HTTP错误: {response.status_code}"
        
        data = response.json()
        print(f"[Profile调试] {symbol}: 原始响应: {data}", file=sys.stderr)
        sys.stderr.flush()
        
        if 'error' in data:
            error_msg = data.get('error', '未知错误')
            print(f"[Profile调试] {symbol}: API错误 {error_msg}", file=sys.stderr)
            sys.stderr.flush()
            return None, error_msg
        
        if not data or len(data) == 0:
            print(f"[Profile调试] {symbol}: 空响应", file=sys.stderr)
            sys.stderr.flush()
            return None, "空响应"
        
        # 检查是否有marketCapitalization字段
        if 'marketCapitalization' not in data:
            print(f"[Profile调试] {symbol}: 没有marketCapitalization字段", file=sys.stderr)
            sys.stderr.flush()
            return None, "没有marketCapitalization字段"
        
        print(f"[Profile调试] {symbol}: 成功获取profile数据", file=sys.stderr)
        sys.stderr.flush()
        return data, None
        
    except Exception as e:
        print(f"[Profile调试] {symbol}: 异常 {e}", file=sys.stderr)
        sys.stderr.flush()
        return None, str(e)

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """股票列表接口 - 包含market cap修复"""
    import sys
    print(f"\n[Market Cap修复] ========== /api/market/stocks 被调用 ==========", file=sys.stderr)
    sys.stderr.flush()
    
    try:
        # 默认股票列表
        DEFAULT_SYMBOLS = ['AAPL', 'TSLA', 'AMD', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'INTC']
        
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
        
        for symbol in DEFAULT_SYMBOLS:
            try:
                print(f"[Market Cap修复] 处理股票: {symbol}")
                
                # 获取报价数据
                quote_data, quote_error = get_finnhub_quote(symbol)
                
                if quote_error or not quote_data:
                    print(f"[Market Cap修复] {symbol}: 报价失败 - {quote_error}")
                    stock_data = {
                        "symbol": symbol,
                        "name": STOCK_NAMES.get(symbol, f"{symbol} Inc."),
                        "price": None,
                        "change": None,
                        "changePercent": None,
                        "marketCap": None,
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
                    print(f"[Market Cap修复] {symbol}: 获取profile数据")
                    profile_data, profile_error = get_finnhub_profile(symbol)
                    market_cap = None
                    
                    if profile_error:
                        print(f"[Market Cap修复] {symbol}: profile失败 - {profile_error}")
                    elif not profile_data:
                        print(f"[Market Cap修复] {symbol}: profile数据为空")
                    else:
                        # Finnhub返回的marketCapitalization单位是百万（million）
                        raw_market_cap = safe_float(profile_data.get('marketCapitalization'), 0)
                        print(f"[Market Cap修复] {symbol}: 原始市值数据: {raw_market_cap}")
                        
                        if raw_market_cap > 0:
                            # 转换为正确的数值：百万 -> 实际数值
                            market_cap = raw_market_cap * 1000000  # 百万转换为实际数值
                            print(f"[Market Cap修复] {symbol}: 计算后市值: {market_cap}")
                    
                    stock_data = {
                        "symbol": symbol,
                        "name": STOCK_NAMES.get(symbol, f"{symbol} Inc."),
                        "price": current_price if current_price > 0 else None,
                        "change": change_amount,
                        "changePercent": change_percent,
                        "dayHigh": day_high if day_high > 0 else None,      # 添加dayHigh字段
                        "dayLow": day_low if day_low > 0 else None,         # 添加dayLow字段
                        "open": open_price if open_price > 0 else None,     # 添加open字段
                        "previousClose": previous_close if previous_close > 0 else None, # 添加previousClose字段
                        "marketCap": market_cap,
                        "currency": "USD",
                        "exchange": "NASDAQ",
                        "industry": STOCK_SECTORS.get(symbol, "Technology"),
                        "sector": STOCK_SECTORS.get(symbol, "Technology"),
                        "dataSource": "Finnhub",
                        "timestamp": int(time.time())
                    }
                    print(f"[Market Cap修复] {symbol}: 成功 - 价格: ${current_price:.2f}, 市值: {market_cap}")
                
                stocks.append(stock_data)
                
            except Exception as e:
                print(f"[Market Cap修复] {symbol}: 异常 - {e}")
                import traceback
                traceback.print_exc()
                stocks.append({
                    "symbol": symbol,
                    "name": STOCK_NAMES.get(symbol, f"{symbol} Inc."),
                    "price": None,
                    "change": None,
                    "changePercent": None,
                    "marketCap": None,
                    "error": str(e)
                })
        
        print(f"[Market Cap修复] 完成: 处理了 {len(stocks)} 支股票")
        
        return jsonify({
            "stocks": stocks,
            "count": len(stocks),
            "dataSource": "Finnhub",
            "timestamp": int(time.time())
        }), 200
        
    except Exception as e:
        print(f"[Market Cap修复] 全局异常: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "stocks": [],
            "count": 0,
            "error": str(e),
            "timestamp": int(time.time())
        }), 500

if __name__ == '__main__':
    import logging
    import sys
    
    # 设置日志级别
    logging.basicConfig(level=logging.DEBUG, stream=sys.stderr)
    
    print("================================================================================", file=sys.stderr)
    print("Market Cap修复版后端启动", file=sys.stderr)
    print("端口: 8889", file=sys.stderr)
    print("================================================================================\n", file=sys.stderr)
    sys.stderr.flush()
    
    app.run(host='127.0.0.1', port=8889, debug=True, use_reloader=False)