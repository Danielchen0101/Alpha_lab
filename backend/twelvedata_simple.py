"""
简化版Twelve Data图表数据源后端
"""

from flask import Flask, request, jsonify
import requests
import time
from datetime import datetime
import pytz

app = Flask(__name__)

# API配置
TWELVEDATA_API_KEY = '8b847a1ef2aa47a68d3f992bd0275f0c'
TWELVEDATA_BASE_URL = 'https://api.twelvedata.com'

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

def convert_twelvedata_to_uniform(values):
    """将Twelve Data数据转换为统一格式"""
    if not values:
        return []
    
    # Twelve Data返回的是倒序（最新的在最后），需要反转
    values_reversed = list(reversed(values))
    
    formatted_data = []
    for item in values_reversed:
        datetime_str = item.get('datetime', '')
        timestamp = None
        
        try:
            if ' ' in datetime_str:
                dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
            else:
                dt = datetime.strptime(datetime_str, '%Y-%m-%d')
            timestamp = int(dt.timestamp())
        except:
            timestamp = int(time.time())
        
        # 转换字段
        try:
            volume_int = int(float(item.get('volume', '0')))
        except:
            volume_int = 0
        
        formatted_data.append({
            "timestamp": timestamp,
            "time": datetime.fromtimestamp(timestamp).isoformat() if timestamp else datetime_str,
            "open": float(item.get('open', 0)),
            "high": float(item.get('high', 0)),
            "low": float(item.get('low', 0)),
            "close": float(item.get('close', 0)),
            "volume": volume_int
        })
    
    return formatted_data

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取股票历史数据（图表数据） - 使用Twelve Data"""
    print(f"[Twelve Data] 获取图表数据: {symbol}")
    
    interval = request.args.get('interval', '60')
    range_param = request.args.get('range', '1week')
    
    print(f"[Twelve Data] 参数: interval={interval}, range={range_param}")
    
    # 参数映射
    interval_map = {
        '30': '30min',
        '60': '1h',
        'D': '1day',
        '1D': '30min',
        '1W': '1h',
        '1M': '1day',
        '3M': '1day',
        '1Y': '1day'
    }
    
    outputsize_map = {
        '1D': 48,
        '1W': 168,
        '1M': 30,
        '3M': 90,
        '1Y': 365
    }
    
    twelvedata_interval = interval_map.get(range_param, interval_map.get(interval, '1h'))
    outputsize = outputsize_map.get(range_param, 100)
    
    try:
        # 请求Twelve Data
        url = f"{TWELVEDATA_BASE_URL}/time_series"
        params = {
            'symbol': symbol.upper(),
            'interval': twelvedata_interval,
            'outputsize': outputsize,
            'apikey': TWELVEDATA_API_KEY,
            'format': 'JSON'
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'values' in data:
                values = data['values']
                formatted_data = convert_twelvedata_to_uniform(values)
                
                print(f"[Twelve Data] 成功获取 {len(formatted_data)} 条图表数据")
                
                response_data = {
                    "data": formatted_data,
                    "count": len(formatted_data),
                    "dataSource": "Twelve Data (图表数据)",
                    "note": f"Twelve Data {range_param}图表数据",
                    "timestamp": int(time.time())
                }
                
                return jsonify(response_data), 200
            else:
                print(f"[Twelve Data] 数据结构异常")
                return jsonify({
                    "data": [],
                    "count": 0,
                    "dataSource": "Twelve Data (图表数据获取失败)",
                    "note": "无法获取图表数据",
                    "timestamp": int(time.time())
                }), 200
        else:
            print(f"[Twelve Data] HTTP错误: {response.status_code}")
            return jsonify({
                "data": [],
                "count": 0,
                "dataSource": f"Twelve Data (HTTP {response.status_code})",
                "note": "图表数据获取失败",
                "timestamp": int(time.time())
            }), 200
            
    except Exception as e:
        print(f"[Twelve Data] 异常: {e}")
        return jsonify({
            "data": [],
            "count": 0,
            "dataSource": f"Twelve Data (异常)",
            "note": "图表数据获取失败",
            "timestamp": int(time.time())
        }), 200

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_detail(symbol):
    """获取股票详情（普通展示数据） - 使用Finnhub"""
    print(f"[Finnhub] 获取股票详情: {symbol}")
    
    try:
        # 获取Finnhub实时报价
        quote_url = f"{FINNHUB_BASE_URL}/quote"
        params = {
            'symbol': symbol.upper(),
            'token': FINNHUB_API_KEY
        }
        
        response = requests.get(quote_url, params=params, timeout=5)
        
        if response.status_code == 200:
            quote_data = response.json()
            
            current_price = quote_data.get('c', 0)
            previous_close = quote_data.get('pc', 0)
            change = current_price - previous_close
            change_percent = (change / previous_close * 100) if previous_close > 0 else 0
            
            stock_info = {
                "symbol": symbol.upper(),
                "name": f"{symbol.upper()} Inc.",
                "price": round(current_price, 2),
                "change": round(change, 2),
                "changePercent": round(change_percent, 2),
                "open": round(quote_data.get('o', 0), 2),
                "dayHigh": round(quote_data.get('h', 0), 2),
                "dayLow": round(quote_data.get('l', 0), 2),
                "volume": int(quote_data.get('v', 0)),
                "marketCap": 0,  # Finnhub免费版不提供市值
                "currency": "USD",
                "exchange": "NASDAQ",
                "industry": "Technology",
                "dataSource": "Finnhub (普通展示数据)"
            }
            
            print(f"[Finnhub] 成功获取股票详情")
            return jsonify(stock_info), 200
        else:
            print(f"[Finnhub] HTTP错误: {response.status_code}")
            return jsonify({
                "symbol": symbol.upper(),
                "name": f"{symbol.upper()} Inc.",
                "price": 0,
                "change": 0,
                "changePercent": 0,
                "dataSource": f"Finnhub (HTTP {response.status_code})"
            }), 200
            
    except Exception as e:
        print(f"[Finnhub] 异常: {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "name": f"{symbol.upper()} Inc.",
            "price": 0,
            "change": 0,
            "changePercent": 0,
            "dataSource": f"Finnhub (异常)"
        }), 200

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """获取市场股票列表（普通展示数据） - 使用Finnhub"""
    print(f"[Finnhub] 获取市场股票列表")
    
    # 获取查询参数
    symbols_param = request.args.get('symbols', '')
    dashboard = request.args.get('dashboard', 'false').lower() == 'true'
    
    print(f"[Finnhub] 参数: symbols={symbols_param}, dashboard={dashboard}")
    
    # 确定要获取的股票列表
    if symbols_param:
        symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    else:
        # 默认股票列表（与前端DEFAULT_SYMBOLS一致）
        symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V']
    
    print(f"[Finnhub] 获取 {len(symbols)} 支股票数据")
    
    stocks = []
    for symbol in symbols:
        try:
            # 获取每支股票的详情
            quote_url = f"{FINNHUB_BASE_URL}/quote"
            params = {
                'symbol': symbol,
                'token': FINNHUB_API_KEY
            }
            
            response = requests.get(quote_url, params=params, timeout=5)
            
            if response.status_code == 200:
                quote_data = response.json()
                
                current_price = quote_data.get('c', 0)
                previous_close = quote_data.get('pc', 0)
                change = current_price - previous_close
                change_percent = (change / previous_close * 100) if previous_close > 0 else 0
                
                # 获取公司信息（如果有）
                name = f"{symbol} Inc."
                try:
                    profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
                    profile_params = {
                        'symbol': symbol,
                        'token': FINNHUB_API_KEY
                    }
                    profile_response = requests.get(profile_url, params=profile_params, timeout=3)
                    if profile_response.status_code == 200:
                        profile_data = profile_response.json()
                        name = profile_data.get('name', name)
                except:
                    pass  # 如果获取公司信息失败，使用默认名称
                
                stock_info = {
                    "symbol": symbol,
                    "name": name,
                    "price": round(current_price, 2),
                    "change": round(change, 2),
                    "changePercent": round(change_percent, 2),
                    "open": round(quote_data.get('o', 0), 2),
                    "dayHigh": round(quote_data.get('h', 0), 2),
                    "dayLow": round(quote_data.get('l', 0), 2),
                    "volume": int(quote_data.get('v', 0)),
                    "marketCap": 0,  # Finnhub免费版不提供市值
                    "currency": "USD",
                    "exchange": "NASDAQ",
                    "industry": "Technology",
                    "dataSource": "Finnhub (普通展示数据)"
                }
                
                stocks.append(stock_info)
                print(f"[Finnhub] ✓ 获取 {symbol} 数据成功")
                
            else:
                print(f"[Finnhub] ✗ 获取 {symbol} 数据失败: HTTP {response.status_code}")
                # 添加基本数据
                stocks.append({
                    "symbol": symbol,
                    "name": f"{symbol} Inc.",
                    "price": 0,
                    "change": 0,
                    "changePercent": 0,
                    "dataSource": f"Finnhub (获取失败)"
                })
                
        except Exception as e:
            print(f"[Finnhub] ✗ 获取 {symbol} 数据异常: {e}")
            # 添加基本数据
            stocks.append({
                "symbol": symbol,
                "name": f"{symbol} Inc.",
                "price": 0,
                "change": 0,
                "changePercent": 0,
                "dataSource": f"Finnhub (异常)"
            })
    
    print(f"[Finnhub] 成功获取 {len([s for s in stocks if s.get('price', 0) > 0])}/{len(symbols)} 支股票数据")
    
    response_data = {
        "stocks": stocks,
        "count": len(stocks),
        "dataSource": "Finnhub (普通展示数据)",
        "timestamp": int(time.time())
    }
    
    return jsonify(response_data), 200

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取系统状态"""
    return jsonify({
        "status": "online",
        "timestamp": int(time.time()),
        "dataSources": {
            "chartData": "Twelve Data",
            "stockData": "Finnhub"
        },
        "version": "1.0.0"
    }), 200

if __name__ == '__main__':
    print("=" * 80)
    print("Twelve Data图表数据源后端启动 (简化版)")
    print(f"图表数据源: Twelve Data")
    print(f"普通展示数据源: Finnhub")
    print(f"端口: 8890")
    print("=" * 80)
    
    app.run(host='127.0.0.1', port=8890, debug=False, use_reloader=False)