#!/usr/bin/env python3
"""
最终修复版后端 - Twelve Data图表数据 + Finnhub普通展示数据
基于工作版本，只修改图表数据源部分
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import time
from datetime import datetime, timedelta
import requests
import pytz

app = Flask(__name__)
CORS(app)

# API配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

TWELVEDATA_API_KEY = '8b847a1ef2aa47a68d3f992bd0275f0c'
TWELVEDATA_BASE_URL = 'https://api.twelvedata.com'

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
        'marketCap': 3200000000000,  # 3.2万亿
        'defaultPrice': 456.89
    },
    'GOOGL': {
        'name': 'Alphabet Inc',
        'sector': 'Technology',
        'marketCap': 2200000000000,  # 2.2万亿
        'defaultPrice': 178.45
    },
    'AMZN': {
        'name': 'Amazon.com Inc',
        'sector': 'Consumer Cyclical',
        'marketCap': 1900000000000,  # 1.9万亿
        'defaultPrice': 189.56
    },
    'META': {
        'name': 'Meta Platforms Inc',
        'sector': 'Technology',
        'marketCap': 1300000000000,  # 1.3万亿
        'defaultPrice': 512.34
    },
    'JPM': {
        'name': 'JPMorgan Chase & Co',
        'sector': 'Financial Services',
        'marketCap': 580000000000,  # 0.58万亿
        'defaultPrice': 198.76
    },
    'JNJ': {
        'name': 'Johnson & Johnson',
        'sector': 'Healthcare',
        'marketCap': 380000000000,  # 0.38万亿
        'defaultPrice': 152.34
    },
    'V': {
        'name': 'Visa Inc',
        'sector': 'Financial Services',
        'marketCap': 550000000000,  # 0.55万亿
        'defaultPrice': 278.90
    }
}

def create_unified_response(data, data_source, note="", count=None, warning=""):
    """创建统一格式的响应"""
    if count is None:
        count = len(data) if data else 0
    
    return {
        "data": data,
        "count": count,
        "dataSource": data_source,
        "note": note,
        "warning": warning,
        "timestamp": int(time.time())
    }

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

def get_twelvedata_historical_data(symbol, interval, range_param):
    """从Twelve Data获取图表历史数据"""
    print(f"  [Twelve Data] 获取图表数据: {symbol}, interval={interval}, range={range_param}")
    
    try:
        # Twelve Data参数映射
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
        
        print(f"  [Twelve Data] 请求参数: interval={twelvedata_interval}, outputsize={outputsize}")
        
        # 构建Twelve Data请求
        url = f"{TWELVEDATA_BASE_URL}/time_series"
        params = {
            'symbol': symbol.upper(),
            'interval': twelvedata_interval,
            'outputsize': outputsize,
            'apikey': TWELVEDATA_API_KEY,
            'format': 'JSON'
        }
        
        response = requests.get(url, params=params, timeout=15)
        print(f"  [Twelve Data] 响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if 'values' in data:
                values = data['values']
                formatted_data = convert_twelvedata_to_uniform(values)
                
                print(f"  [Twelve Data] 成功获取 {len(formatted_data)} 条图表数据")
                
                # 根据时间范围添加备注
                note = f"Twelve Data {range_param}图表数据"
                if range_param == '1W':
                    note = "Twelve Data 最近1周小时图表数据（包含今日）"
                
                return formatted_data, True, note
            else:
                print(f"  [Twelve Data] 数据结构异常")
                return [], False, 'Twelve Data (数据结构错误)'
        else:
            print(f"  [Twelve Data] HTTP错误: {response.status_code}")
            return [], False, f'Twelve Data (HTTP {response.status_code})'
            
    except Exception as e:
        print(f"  [Twelve Data] 请求异常: {e}")
        return [], False, f'Twelve Data (异常: {str(e)[:100]})'

def get_finnhub_stock_detail(symbol):
    """从Finnhub获取股票详情（普通展示数据）"""
    print(f"  [Finnhub] 获取股票详情: {symbol}")
    
    try:
        # 获取实时报价
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
            
            # 从数据库获取公司信息
            stock_info = STOCK_INFO_DB.get(symbol.upper(), {})
            
            stock_data = {
                "symbol": symbol.upper(),
                "name": stock_info.get('name', f'{symbol.upper()} Inc.'),
                "price": round(current_price, 2),
                "change": round(change, 2),
                "changePercent": round(change_percent, 2),
                "open": round(quote_data.get('o', 0), 2),
                "dayHigh": round(quote_data.get('h', 0), 2),
                "dayLow": round(quote_data.get('l', 0), 2),
                "volume": int(quote_data.get('v', 0)),
                "marketCap": stock_info.get('marketCap', 0),
                "currency": "USD",
                "exchange": "NASDAQ",
                "industry": stock_info.get('sector', 'Technology'),
                "dataSource": "Finnhub (普通展示数据)"
            }
            
            print(f"  [Finnhub] 成功获取股票详情")
            return stock_data, True, 'Finnhub'
        else:
            print(f"  [Finnhub] 请求失败: {response.status_code}")
            return {}, False, f'Finnhub (HTTP {response.status_code})'
            
    except Exception as e:
        print(f"  [Finnhub] 请求异常: {e}")
        return {}, False, f'Finnhub (异常: {str(e)[:100]})'

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """获取股票历史数据（图表数据） - 使用Twelve Data"""
    print(f"\n=== 获取股票历史数据 (图表数据) ===")
    print(f"股票: {symbol}")
    
    interval = request.args.get('interval', '60')
    range_param = request.args.get('range', '1week')
    
    print(f"参数: interval={interval}, range={range_param}")
    print(f"数据源: Twelve Data (图表数据)")
    
    # 从Twelve Data获取图表数据
    historical_data, success, data_source_note = get_twelvedata_historical_data(symbol, interval, range_param)
    
    if success and historical_data:
        response = create_unified_response(
            data=historical_data,
            data_source=f"Twelve Data (图表数据)",
            note=data_source_note,
            count=len(historical_data)
        )
        print(f"✓ 成功返回 {len(historical_data)} 条图表数据")
        return jsonify(response), 200
    else:
        response = create_unified_response(
            data=[],
            data_source="Twelve Data (图表数据获取失败)",
            note="无法获取图表数据",
            warning=f"Twelve Data图表数据获取失败: {data_source_note}"
        )
        print(f"✗ 图表数据获取失败")
        return jsonify(response), 200

@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_detail(symbol):
    """获取股票详情（普通展示数据） - 使用Finnhub"""
    print(f"\n=== 获取股票详情 (普通展示数据) ===")
    print(f"股票: {symbol}")
    print(f"数据源: Finnhub (普通展示数据)")
    
    # 从Finnhub获取普通展示数据
    stock_info, success, data_source_note = get_finnhub_stock_detail(symbol)
    
    if success and stock_info:
        print(f"✓ 成功返回股票详情")
        return jsonify(stock_info), 200
    else:
        # 如果Finnhub失败，返回数据库中的基本数据
        stock_info = STOCK_INFO_DB.get(symbol.upper(), {})
        fallback_data = {
            "symbol": symbol.upper(),
            "name": stock_info.get('name', f"{symbol.upper()} Inc."),
            "price": stock_info.get('defaultPrice', 0),
            "change": 0,
            "changePercent": 0,
            "open": stock_info.get('defaultPrice', 0),
            "dayHigh": stock_info.get('defaultPrice', 0),
            "dayLow": stock_info.get('defaultPrice', 0),
            "volume": 0,
            "marketCap": stock_info.get('marketCap', 0),
            "currency": "USD",
            "exchange": "NASDAQ",
            "industry": stock_info.get('sector', 'Technology'),
            "dataSource": f"Finnhub获取失败，使用默认数据 ({data_source_note})"
        }
        print(f"✗ Finnhub获取失败，使用默认数据")
        return jsonify(fallback_data), 200

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """获取市场股票列表（普通展示数据） - 使用Finnhub"""
    print(f"\n=== 获取市场股票列表 (普通展示数据) ===")
    print(f"数据源: Finnhub (普通展示数据)")
    
    # 获取查询参数
    symbols_param = request.args.get('symbols', '')
    dashboard = request.args.get('dashboard', 'false').lower() == 'true'
    
    print(f"参数: symbols={symbols_param}, dashboard={dashboard}")
    
    # 确定要获取的股票列表
    if symbols_param:
        symbols = [s.strip().upper() for s in symbols_param.split(',') if s.strip()]
    else:
        # 默认股票列表（与前端DEFAULT_SYMBOLS一致）
        symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V']
    
    print(f"获取 {len(symbols)} 支股票数据")
    
    stocks = []
    success_count = 0
    
    for symbol in symbols:
        stock_info, success, _ = get_finnhub_stock_detail(symbol)
        
        if success:
            success_count += 1
            stocks.append(stock_info)
            print(f"✓ 获取 {symbol} 数据成功")
        else:
            # 如果获取失败，添加数据库中的基本数据
            stock_info = STOCK_INFO_DB.get(symbol, {})
            stocks.append({
                "symbol": symbol,
                "name": stock_info.get('name', f"{symbol} Inc."),
                "price": stock_info.get('defaultPrice', 0),
                "change": 0,
                "changePercent": 0,
                "dataSource": "Finnhub (获取失败，使用默认数据)"
            })
            print(f"✗ 获取 {symbol} 数据失败")
    
    print(f"成功获取 {success_count}/{len(symbols)} 支股票数据")
    
    response = {
        "stocks": stocks,
        "count": len(stocks),
        "dataSource": "Finnhub (普通展示数据)",
        "timestamp": int(time.time())
    }
    
    return jsonify(response), 200

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
    print("最终修复版后端启动")
    print(f"图表数据源: Twelve Data")
    print(f"普通展示数据源: Finnhub")
    print(f"端口: 8890")
    print("=" * 80)
    
    app.run(host='127.0.0.1', port=8890, debug=False)