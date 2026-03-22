"""
主后端文件 - 专业量化平台
统一入口点，修复所有语法错误
"""

print("================================================")
print("专业量化平台后端启动")
print("文件: quant_backend_main.py")
print("端口: 8890")
print("================================================")

from flask import Flask, request, jsonify
import requests
import time
from datetime import datetime
import traceback

app = Flask(__name__)

# ==================== 配置 ====================
# 使用用户提供的有效API key
FINNHUB_API_KEY = "d6v2q09r01qig546aus0d6v2q09r01qig546ausg"
print(f"[配置] 使用Finnhub API Key: {FINNHUB_API_KEY[:10]}...")

TWELVEDATA_API_KEY = "3541c054d16843cb8e4b2ccefa456a01"

# ==================== 工具函数 ====================
def get_finnhub_stock_data(symbol):
    """获取单支股票数据"""
    try:
        url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={FINNHUB_API_KEY}"
        print(f"[Finnhub] 请求 {symbol}: {url[:80]}...")
        response = requests.get(url, timeout=10)
        
        print(f"[Finnhub] {symbol} 响应状态: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[Finnhub] {symbol} 响应数据: {data}")
            
            # 检查数据是否有效
            if data.get('c') is not None:
                return {
                    "symbol": symbol,
                    "price": data.get('c', 0),
                    "change": data.get('d', 0),
                    "changePercent": data.get('dp', 0),
                    "high": data.get('h', 0),
                    "low": data.get('l', 0),
                    "open": data.get('o', 0),
                    "previousClose": data.get('pc', 0),
                    "timestamp": data.get('t', int(time.time())),
                    "dataSource": "Finnhub"
                }
            else:
                print(f"[Finnhub] {symbol} 数据无效: {data}")
                return None
        else:
            print(f"[Finnhub] HTTP {response.status_code} for {symbol}, 响应: {response.text[:100]}")
            return None
    except Exception as e:
        print(f"[Finnhub] 获取 {symbol} 数据异常: {e}")
        return None

def get_finnhub_stock_data_batch(symbols):
    """批量获取股票数据"""
    stocks = []
    for symbol in symbols:
        stock_data = get_finnhub_stock_data(symbol)
        if stock_data:
            stocks.append(stock_data)
    return stocks

def get_finnhub_profile(symbol):
    """获取股票基本信息"""
    try:
        url = f"https://finnhub.io/api/v1/stock/profile2?symbol={symbol}&token={FINNHUB_API_KEY}"
        response = requests.get(url, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return {
                "symbol": symbol,
                "name": data.get('name', symbol),
                "exchange": data.get('exchange', 'N/A'),
                "currency": data.get('currency', 'USD'),
                "country": data.get('country', 'US'),
                "ipo": data.get('ipo', ''),
                "marketCapitalization": data.get('marketCapitalization', 0),
                "shareOutstanding": data.get('shareOutstanding', 0),
                "logo": data.get('logo', ''),
                "phone": data.get('phone', ''),
                "weburl": data.get('weburl', ''),
                "finnhubIndustry": data.get('finnhubIndustry', ''),
                "dataSource": "Finnhub"
            }
        else:
            print(f"[Finnhub Profile] HTTP {response.status_code} for {symbol}")
            return None
    except Exception as e:
        print(f"[Finnhub Profile] 获取 {symbol} 信息异常: {e}")
        return None

# 缓存
_profile_cache = {}
_cache_ttl = 24 * 60 * 60  # 24小时

def get_finnhub_profiles_concurrent(symbols):
    """并发获取股票信息"""
    import concurrent.futures
    profiles = []
    
    # 检查缓存
    for symbol in symbols:
        if symbol in _profile_cache:
            cache_entry = _profile_cache[symbol]
            if time.time() - cache_entry['timestamp'] < _cache_ttl:
                profiles.append(cache_entry['data'])
                symbols = [s for s in symbols if s != symbol]
    
    if not symbols:
        return profiles
    
    # 并发获取剩余数据
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_symbol = {executor.submit(get_finnhub_profile, symbol): symbol for symbol in symbols}
        
        for future in concurrent.futures.as_completed(future_to_symbol):
            symbol = future_to_symbol[future]
            try:
                profile = future.result()
                if profile:
                    # 更新缓存
                    _profile_cache[symbol] = {
                        'data': profile,
                        'timestamp': time.time()
                    }
                    profiles.append(profile)
            except Exception as e:
                print(f"[并发获取] {symbol} 信息失败: {e}")
    
    return profiles

def get_twelvedata_history(symbol, range_param="1day", interval="1min"):
    """获取Twelve Data历史数据"""
    try:
        # 映射输出大小
        outputsize_map = {
            "1day": 390,
            "1week": 300,
            "1month": 600,
            "3months": 600,
            "1year": 1000
        }
        
        outputsize = outputsize_map.get(range_param, 100)
        
        # 映射interval到Twelve Data支持的格式
        interval_map = {
            "1": "1min",
            "5": "5min",
            "15": "15min",
            "30": "30min",
            "60": "1h",
            "D": "1day",
            "W": "1week",
            "M": "1month"
        }
        
        twelvedata_interval = interval_map.get(interval, interval)
        
        # 构建API URL
        url = f"https://api.twelvedata.com/time_series"
        params = {
            "symbol": symbol,
            "interval": twelvedata_interval,
            "outputsize": outputsize,
            "apikey": TWELVEDATA_API_KEY,
            "format": "JSON"
        }
        
        print(f"[Twelve Data] 请求: {symbol}, range={range_param}, interval={interval}->{twelvedata_interval}, outputsize={outputsize}")
        
        response = requests.get(url, params=params, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'values' in data:
                values = data['values']
                print(f"[Twelve Data] 原始数据点数: {len(values)}")
                
                formatted_data = []
                for i, item in enumerate(values):
                    datetime_str = item.get('datetime', '')
                    close_price = float(item.get('close', 0))
                    
                    # 解析时间戳
                    timestamp = int(time.time())
                    if datetime_str:
                        try:
                            dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
                            timestamp = int(dt.timestamp())
                        except:
                            pass
                    
                    formatted_data.append({
                        "timestamp": timestamp,
                        "time": datetime_str,
                        "open": float(item.get('open', 0)),
                        "high": float(item.get('high', 0)),
                        "low": float(item.get('low', 0)),
                        "close": close_price,
                        "volume": int(float(item.get('volume', 0))),
                        "dataSource": "Twelve Data"
                    })
                
                print(f"[Twelve Data] 格式化数据点数: {len(formatted_data)}")
                return formatted_data, True, f"Twelve Data {range_param}图表数据"
            else:
                return [], False, "Twelve Data (数据结构错误)"
        else:
            return [], False, f"Twelve Data (HTTP {response.status_code})"
            
    except Exception as e:
        return [], False, f"Twelve Data (异常: {str(e)[:100]})"

# ==================== API路由 ====================
@app.route('/api/system/status', methods=['GET'])
def get_status():
    """系统状态检查"""
    return jsonify({
        "status": "ok",
        "timestamp": int(time.time()),
        "version": "quant-backend-main-1.0",
        "message": "专业量化平台后端运行正常",
        "endpoints": {
            "market_stocks": "/api/market/stocks",
            "stock_history": "/api/market/history/<symbol>",
            "system_status": "/api/system/status"
        }
    })

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """Market页面和Dashboard股票列表接口"""
    try:
        symbols_param = request.args.get('symbols', 'AAPL,MSFT,GOOGL,AMZN,TSLA,META,NVDA,JPM,JNJ,V')
        symbols = [s.strip() for s in symbols_param.split(',') if s.strip()]
        
        print(f"[API] 获取 {len(symbols)} 支股票数据")
        
        # 使用批量获取优化性能
        if len(symbols) > 1:
            print(f"[API] 使用批量获取模式")
            stocks = get_finnhub_stock_data_batch(symbols)
        else:
            print(f"[API] 使用单股票获取模式")
            stocks = []
            for symbol in symbols:
                try:
                    print(f"[API] 开始获取 {symbol} 数据...")
                    stock_data = get_finnhub_stock_data(symbol)
                    if stock_data:
                        stocks.append(stock_data)
                        print(f"[API] {symbol}: ${stock_data['price']:.2f} ({stock_data['changePercent']:.2f}%)")
                except Exception as e:
                    print(f"[API] 获取 {symbol} 数据失败: {e}")
        
        # 获取股票信息
        profiles = get_finnhub_profiles_concurrent(symbols)
        
        # 合并数据
        for stock in stocks:
            symbol = stock['symbol']
            profile = next((p for p in profiles if p['symbol'] == symbol), None)
            if profile:
                stock.update({
                    "name": profile.get('name', symbol),
                    "marketCap": profile.get('marketCapitalization', 0)
                })
        
        return jsonify({
            "stocks": stocks,
            "count": len(stocks),
            "dataSource": "Finnhub + 缓存优化",
            "timestamp": int(time.time())
        })
        
    except Exception as e:
        print(f"[API] /api/market/stocks 异常: {e}")
        return jsonify({
            "stocks": [],
            "count": 0,
            "error": str(e),
            "timestamp": int(time.time())
        }), 500

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取股票历史数据"""
    try:
        range_param = request.args.get('range', '1day')
        interval = request.args.get('interval', '1min')
        
        print(f"[API] /api/market/history/{symbol} 请求: range={range_param}, interval={interval}")
        
        # 获取Twelve Data数据
        data, success, note = get_twelvedata_history(symbol, range_param, interval)
        
        return jsonify({
            "data": data,
            "count": len(data),
            "dataSource": "Twelve Data",
            "note": note,
            "success": success,
            "timestamp": int(time.time())
        })
        
    except Exception as e:
        print(f"[API] /api/market/history/{symbol} 异常: {e}")
        return jsonify({
            "data": [],
            "count": 0,
            "error": str(e),
            "timestamp": int(time.time())
        }), 500

# ==================== 主程序 ====================
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8890, debug=False, threaded=True)