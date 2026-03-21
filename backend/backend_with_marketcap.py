"""
修复版本后端 - 包含合理的marketCap数据
Finnhub: Dashboard和Market普通数据 (包含模拟marketCap)
Twelve Data: Analyze/Chart图表数据
"""

from flask import Flask, request, jsonify
import requests
import time

app = Flask(__name__)

# API配置
TWELVEDATA_API_KEY = '8b847a1ef2aa47a68d3f992bd0275f0c'
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'

# 默认股票列表 - 10支股票
DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V']

# 股票信息数据库 - 包含合理的marketCap值（单位：美元）
STOCK_INFO = {
    'AAPL': {
        'name': 'Apple Inc', 
        'sector': 'Technology',
        'marketCap': 3_800_000_000_000,  # 3.8万亿
        'defaultPrice': 248.96
    },
    'MSFT': {
        'name': 'Microsoft Corp', 
        'sector': 'Technology',
        'marketCap': 3_200_000_000_000,  # 3.2万亿
        'defaultPrice': 456.89
    },
    'GOOGL': {
        'name': 'Alphabet Inc', 
        'sector': 'Technology',
        'marketCap': 2_200_000_000_000,  # 2.2万亿
        'defaultPrice': 178.45
    },
    'TSLA': {
        'name': 'Tesla Inc', 
        'sector': 'Automotive',
        'marketCap': 780_000_000_000,  # 0.78万亿
        'defaultPrice': 245.23
    },
    'NVDA': {
        'name': 'NVIDIA Corp', 
        'sector': 'Technology',
        'marketCap': 4_380_000_000_000,  # 4.38万亿
        'defaultPrice': 179.11
    },
    'AMZN': {
        'name': 'Amazon.com Inc', 
        'sector': 'Consumer Cyclical',
        'marketCap': 1_900_000_000_000,  # 1.9万亿
        'defaultPrice': 189.56
    },
    'META': {
        'name': 'Meta Platforms Inc', 
        'sector': 'Technology',
        'marketCap': 1_300_000_000_000,  # 1.3万亿
        'defaultPrice': 512.34
    },
    'JPM': {
        'name': 'JPMorgan Chase & Co', 
        'sector': 'Financial Services',
        'marketCap': 580_000_000_000,  # 0.58万亿
        'defaultPrice': 198.76
    },
    'JNJ': {
        'name': 'Johnson & Johnson', 
        'sector': 'Healthcare',
        'marketCap': 380_000_000_000,  # 0.38万亿
        'defaultPrice': 152.34
    },
    'V': {
        'name': 'Visa Inc', 
        'sector': 'Financial Services',
        'marketCap': 550_000_000_000,  # 0.55万亿
        'defaultPrice': 278.90
    }
}

def get_finnhub_quote(symbol):
    """从Finnhub获取股票报价"""
    try:
        url = "https://finnhub.io/api/v1/quote"
        params = {'symbol': symbol, 'token': FINNHUB_API_KEY}
        response = requests.get(url, params=params, timeout=3)
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"[Finnhub] {symbol} HTTP错误: {response.status_code}")
            return None
    except Exception as e:
        print(f"[Finnhub] {symbol} 异常: {e}")
        return None

def create_stock_data(symbol, quote_data):
    """创建股票数据对象"""
    stock_info = STOCK_INFO.get(symbol, {
        'name': f'{symbol} Inc.',
        'sector': 'Technology',
        'marketCap': 0,
        'defaultPrice': 0
    })
    
    if quote_data:
        try:
            current_price = float(quote_data.get('c', stock_info['defaultPrice']))
            previous_close = float(quote_data.get('pc', current_price))
            change = current_price - previous_close
            change_percent = (change / previous_close * 100) if previous_close > 0 else 0
            
            return {
                "symbol": symbol,
                "name": stock_info['name'],
                "price": round(current_price, 2),
                "change": round(change, 2),
                "changePercent": round(change_percent, 2),
                "open": round(float(quote_data.get('o', current_price)), 2),
                "dayHigh": round(float(quote_data.get('h', current_price)), 2),
                "dayLow": round(float(quote_data.get('l', current_price)), 2),
                "volume": int(float(quote_data.get('v', 0))),
                "marketCap": stock_info['marketCap'],  # 使用数据库中的合理市值
                "currency": "USD",
                "exchange": "NASDAQ",
                "industry": stock_info['sector'],
                "dataSource": "Finnhub (普通展示数据，市值基于合理估算)"
            }
        except Exception as e:
            print(f"[数据处理] {symbol} 异常: {e}")
            # 降级处理
            return {
                "symbol": symbol,
                "name": stock_info['name'],
                "price": stock_info['defaultPrice'],
                "change": 0,
                "changePercent": 0,
                "marketCap": stock_info['marketCap'],
                "dataSource": "Finnhub (数据处理异常，使用默认数据)"
            }
    else:
        # 降级数据
        return {
            "symbol": symbol,
            "name": stock_info['name'],
            "price": stock_info['defaultPrice'],
            "change": 0,
            "changePercent": 0,
            "open": stock_info['defaultPrice'],
            "dayHigh": stock_info['defaultPrice'],
            "dayLow": stock_info['defaultPrice'],
            "volume": 0,
            "marketCap": stock_info['marketCap'],
            "currency": "USD",
            "exchange": "NASDAQ",
            "industry": stock_info['sector'],
            "dataSource": "Finnhub (获取失败，使用默认数据)"
        }

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """Market页面和Dashboard股票列表接口 - 使用Finnhub"""
    print(f"[API] /api/market/stocks 被调用 (Finnhub)")
    
    try:
        # 获取参数
        symbols_param = request.args.get('symbols', '')
        dashboard = request.args.get('dashboard', 'false').lower() == 'true'
        
        print(f"[API] 参数: symbols='{symbols_param}', dashboard={dashboard}")
        
        # 确定股票列表
        if symbols_param and symbols_param.strip():
            symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
        else:
            symbols = DEFAULT_SYMBOLS
        
        print(f"[API] 获取 {len(symbols)} 支股票数据")
        
        stocks = []
        
        for symbol in symbols:
            print(f"[API] 处理股票: {symbol}")
            quote_data = get_finnhub_quote(symbol)
            stock_data = create_stock_data(symbol, quote_data)
            stocks.append(stock_data)
            
            # 打印marketCap信息
            market_cap = stock_data['marketCap']
            if market_cap >= 1_000_000_000_000:
                cap_str = f"{market_cap / 1_000_000_000_000:.2f}T"
            elif market_cap >= 1_000_000_000:
                cap_str = f"{market_cap / 1_000_000_000:.2f}B"
            else:
                cap_str = f"{market_cap / 1_000_000:.2f}M"
            
            print(f"[API] {symbol}: ${stock_data['price']:.2f} ({stock_data['changePercent']:.2f}%), 市值: ${cap_str}")
        
        response_data = {
            "stocks": stocks,
            "count": len(stocks),
            "dataSource": "Finnhub (普通展示数据，市值基于合理估算)",
            "timestamp": int(time.time())
        }
        
        print(f"[API] 返回 {len(stocks)} 支股票数据")
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"[API] 异常: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "stocks": [],
            "count": 0,
            "dataSource": "Finnhub (错误)",
            "timestamp": int(time.time())
        }), 200

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_detail(symbol):
    """单股详情接口 - 使用Finnhub"""
    print(f"[API] /api/market/stock/{symbol} 被调用 (Finnhub)")
    
    try:
        symbol = symbol.upper()
        quote_data = get_finnhub_quote(symbol)
        stock_data = create_stock_data(symbol, quote_data)
        
        print(f"[API] 返回 {symbol} 详情")
        return jsonify(stock_data), 200
            
    except Exception as e:
        print(f"[API] 异常: {e}")
        return jsonify({
            "symbol": symbol.upper(),
            "name": f"{symbol.upper()} Inc.",
            "price": 0,
            "change": 0,
            "changePercent": 0,
            "marketCap": 0,
            "dataSource": "Finnhub (异常)"
        }), 200

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """图表历史数据接口 - 使用Twelve Data"""
    print(f"[API] /api/market/history/{symbol} 被调用 (Twelve Data)")
    
    try:
        interval = request.args.get('interval', '60')
        range_param = request.args.get('range', '1week')
        
        print(f"[API] 参数: interval={interval}, range={range_param}")
        
        # Twelve Data参数映射
        interval_map = {
            '30': '30min',
            '60': '1h',
            'D': '1day'
        }
        
        outputsize_map = {
            '1day': 48,
            '1week': 168,
            '1month': 30,
            '3month': 90,
            '1year': 365
        }
        
        twelvedata_interval = interval_map.get(interval, '1h')
        outputsize = outputsize_map.get(range_param, 100)
        
        # 请求Twelve Data
        url = "https://api.twelvedata.com/time_series"
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
                
                # 转换数据格式
                formatted_data = []
                for item in values:
                    try:
                        formatted_data.append({
                            "timestamp": int(time.time()),  # 简化时间戳
                            "time": item.get('datetime', ''),
                            "open": float(item.get('open', 0)),
                            "high": float(item.get('high', 0)),
                            "low": float(item.get('low', 0)),
                            "close": float(item.get('close', 0)),
                            "volume": int(float(item.get('volume', '0')))
                        })
                    except:
                        continue
                
                # 反转数据顺序（最新的在最后）
                formatted_data = list(reversed(formatted_data))
                
                response_data = {
                    "data": formatted_data,
                    "count": len(formatted_data),
                    "dataSource": "Twelve Data (图表数据)",
                    "note": f"Twelve Data {range_param}图表数据",
                    "timestamp": int(time.time())
                }
                
                print(f"[API] 返回 {len(formatted_data)} 条图表数据")
                return jsonify(response_data), 200
            else:
                print(f"[API] Twelve Data数据结构错误")
                return jsonify({
                    "data": [],
                    "count": 0,
                    "dataSource": "Twelve Data (数据结构错误)",
                    "note": "无法获取图表数据",
                    "timestamp": int(time.time())
                }), 200
        else:
            print(f"[API] Twelve Data HTTP错误: {response.status_code}")
            return jsonify({
                "data": [],
                "count": 0,
                "dataSource": f"Twelve Data (HTTP错误)",
                "note": "无法获取图表数据",
                "timestamp": int(time.time())
            }), 200
            
    except Exception as e:
        print(f"[API] 异常: {e}")
        return jsonify({
            "data": [],
            "count": 0,
            "dataSource": "Twelve Data (异常)",
            "note": "无法获取图表数据",
            "timestamp": int(time.time())
        }), 200

@app.route('/api/status', methods=['GET'])
def get_status():
    """系统状态接口"""
    return jsonify({
        "status": "online",
        "timestamp": int(time.time()),
        "dataSources": {
            "dashboardData": "Finnhub (包含合理市值估算)",
            "marketData": "Finnhub (包含合理市值估算)",
            "chartData": "Twelve Data"
        },
        "version": "1.0.0"
    }), 200

if __name__ == '__main__':
    print("=" * 80)
    print("修复版本后端启动 (包含合理marketCap数据)")
    print("数据源职责明确:")
    print("  - Dashboard 和 Market 普通数据: Finnhub (包含合理市值估算)")
    print("  - Analyze/Chart 图表数据: Twelve Data")
    print(f"默认股票: {DEFAULT_SYMBOLS}")
    print(f"股票数量: {len(DEFAULT_SYMBOLS)}")
    print("股票市值示例:")
    for symbol in DEFAULT_SYMBOLS:
        info = STOCK_INFO.get(symbol, {})
        market_cap = info.get('marketCap', 0)
        if market_cap >= 1_000_000_000_000:
            cap_str = f"{market_cap / 1_000_000_000_000:.2f}T"
        elif market_cap >= 1_000_000_000:
            cap_str = f"{market_cap / 1_000_000_000:.2f}B"
        else:
            cap_str = f"{market_cap / 1_000_000:.2f}M"
        print(f"  {symbol}: ${cap_str}")
    print(f"端口: 8891")
    print("=" * 80)
    
    app.run(host='127.0.0.1', port=8891, debug=False, use_reloader=False)