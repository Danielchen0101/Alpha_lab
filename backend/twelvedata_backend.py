"""
Twelve Data作为图表数据源的后端
Finnhub负责普通展示数据，Twelve Data负责图表数据
"""

from flask import Flask, request, jsonify
import requests
import json
import time
from datetime import datetime, timedelta
import pytz
import random
from functools import lru_cache

app = Flask(__name__)

# API配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

TWELVEDATA_API_KEY = '8b847a1ef2aa47a68d3f992bd0275f0c'
TWELVEDATA_BASE_URL = 'https://api.twelvedata.com'

# 缓存配置
historical_cache = {}
CACHE_TTL = 300  # 5分钟缓存时间

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

def get_twelvedata_historical_data(symbol, interval, range_param):
    """从Twelve Data获取图表历史数据"""
    print(f"  [Twelve Data] 尝试获取图表历史数据: {symbol}, interval={interval}, range={range_param}")
    
    # 缓存键
    cache_key = f"twelvedata_{symbol}_{interval}_{range_param}"
    if cache_key in historical_cache:
        cached_data, timestamp = historical_cache[cache_key]
        if time.time() - timestamp < CACHE_TTL:
            print(f"  [Twelve Data CACHE HIT] 使用缓存数据")
            return cached_data
    
    try:
        # Twelve Data参数映射
        # 前端参数 -> Twelve Data参数
        interval_map = {
            '30': '30min',      # 30分钟
            '60': '1h',         # 1小时
            'D': '1day',        # 1天
            '1D': '30min',      # 1天使用30分钟数据
            '1W': '1h',         # 1周使用1小时数据
            '1M': '1day',       # 1月使用日线数据
            '3M': '1day',       # 3月使用日线数据
            '1Y': '1day'        # 1年使用日线数据
        }
        
        # 输出大小映射
        outputsize_map = {
            '1D': 48,      # 1天30分钟数据: 48个点 (24小时 * 2)
            '1W': 168,     # 1周小时数据: 168个点 (7天 * 24小时)
            '1M': 30,      # 1月日线数据: 30个点
            '3M': 90,      # 3月日线数据: 90个点
            '1Y': 365      # 1年日线数据: 365个点
        }
        
        # 获取Twelve Data参数
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
        
        print(f"  [Twelve Data] 请求URL: {url}")
        print(f"  [Twelve Data] 请求参数: {params}")
        
        response = requests.get(url, params=params, timeout=15)
        print(f"  [Twelve Data] 响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
            except Exception as e:
                print(f"  [Twelve Data] JSON解析失败: {e}")
                print(f"  [Twelve Data] 响应内容: {response.text[:200]}")
                return [], False, 'Twelve Data (JSON解析失败)'
            
            # 检查数据结构
            if 'values' in data:
                values = data['values']
                print(f"  [Twelve Data] 原始数据条数: {len(values)}")
                
                if len(values) > 0:
                    # Twelve Data返回的是倒序（最新的在最后），需要反转
                    values_reversed = list(reversed(values))
                    
                    # 转换为统一格式
                    formatted_data = []
                    for item in values_reversed:
                        # 解析时间戳
                        datetime_str = item.get('datetime', '')
                        timestamp = None
                        
                        try:
                            # 尝试解析不同格式的时间
                            if ' ' in datetime_str:
                                # 格式: "2026-03-19 15:30:00"
                                dt = datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
                            else:
                                # 格式: "2026-03-19"
                                dt = datetime.strptime(datetime_str, '%Y-%m-%d')
                            
                            # 转换为UTC时间戳
                            timestamp = int(dt.timestamp())
                        except Exception as e:
                            print(f"  [Twelve Data] 时间解析失败: {datetime_str}, 错误: {e}")
                            # 使用当前时间作为fallback
                            timestamp = int(time.time())
                        
                        # 确保所有字段都有值
                        open_price = float(item.get('open', 0))
                        high_price = float(item.get('high', 0))
                        low_price = float(item.get('low', 0))
                        close_price = float(item.get('close', 0))
                        volume_val = item.get('volume', '0')
                        
                        # 处理volume字段
                        try:
                            volume_int = int(float(volume_val))
                        except:
                            volume_int = 0
                        
                        formatted_data.append({
                            "timestamp": timestamp,
                            "time": datetime.fromtimestamp(timestamp).isoformat() if timestamp else datetime_str,
                            "open": open_price,
                            "high": high_price,
                            "low": low_price,
                            "close": close_price,
                            "volume": volume_int
                        })
                    
                    print(f"  [Twelve Data] 转换后数据条数: {len(formatted_data)}")
                    
                    # 显示第一条和最后一条数据
                    if len(formatted_data) > 0:
                        first = formatted_data[0]
                        last = formatted_data[-1]
                        
                        print(f"  [Twelve Data] 第一条数据 (最早):")
                        print(f"    时间: {datetime.fromtimestamp(first['timestamp']).strftime('%Y-%m-%d %H:%M:%S')}")
                        print(f"    价格: O=${first['open']:.2f}, H=${first['high']:.2f}, L=${first['low']:.2f}, C=${first['close']:.2f}")
                        
                        print(f"  [Twelve Data] 最后一条数据 (最新):")
                        print(f"    时间: {datetime.fromtimestamp(last['timestamp']).strftime('%Y-%m-%d %H:%M:%S')}")
                        print(f"    价格: O=${last['open']:.2f}, H=${last['high']:.2f}, L=${last['low']:.2f}, C=${last['close']:.2f}")
                    
                    # 缓存数据
                    historical_cache[cache_key] = (formatted_data, time.time())
                    
                    # 根据时间范围添加备注
                    note = f"Twelve Data {range_param}图表数据"
                    if range_param == '1W':
                        note = "Twelve Data 最近1周小时图表数据（包含今日）"
                    
                    return formatted_data, True, note
                else:
                    print(f"  [Twelve Data] 无数据返回")
                    return [], False, 'Twelve Data (无数据)'
            else:
                print(f"  [Twelve Data] 数据结构异常: {list(data.keys())}")
                if 'code' in data:
                    print(f"  [Twelve Data] 错误代码: {data.get('code')}")
                if 'message' in data:
                    print(f"  [Twelve Data] 错误信息: {data.get('message')}")
                return [], False, 'Twelve Data (数据结构错误)'
        else:
            print(f"  [Twelve Data] HTTP错误: {response.text[:200]}")
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
            
            # 获取公司信息
            profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
            profile_params = {
                'symbol': symbol.upper(),
                'token': FINNHUB_API_KEY
            }
            
            profile_response = requests.get(profile_url, params=profile_params, timeout=5)
            profile_data = {}
            if profile_response.status_code == 200:
                profile_data = profile_response.json()
            
            # 构建响应
            current_price = quote_data.get('c', 0)
            previous_close = quote_data.get('pc', 0)
            change = current_price - previous_close
            change_percent = (change / previous_close * 100) if previous_close > 0 else 0
            
            stock_info = {
                "symbol": symbol.upper(),
                "name": profile_data.get('name', f'{symbol.upper()} Inc.'),
                "price": round(current_price, 2),
                "change": round(change, 2),
                "changePercent": round(change_percent, 2),
                "open": round(quote_data.get('o', 0), 2),
                "dayHigh": round(quote_data.get('h', 0), 2),
                "dayLow": round(quote_data.get('l', 0), 2),
                "volume": int(quote_data.get('v', 0)),
                "marketCap": profile_data.get('marketCapitalization', 0),
                "currency": profile_data.get('currency', 'USD'),
                "exchange": profile_data.get('exchange', 'NASDAQ'),
                "industry": profile_data.get('finnhubIndustry', 'Technology'),
                "dataSource": "Finnhub (普通展示数据)"
            }
            
            print(f"  [Finnhub] 成功获取股票详情")
            print(f"    价格: ${stock_info['price']:.2f}")
            print(f"    涨跌: ${stock_info['change']:.2f} ({stock_info['changePercent']:.2f}%)")
            
            return stock_info, True, 'Finnhub'
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
    
    # 获取查询参数
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
        # 如果Twelve Data失败，返回空数据
        response = create_unified_response(
            data=[],
            data_source="Twelve Data (图表数据获取失败)",
            note="无法获取图表数据",
            warning=f"Twelve Data图表数据获取失败: {data_source_note}"
        )
        print(f"✗ 图表数据获取失败")
        return jsonify(response), 200  # 仍然返回200，但数据为空

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
        # 如果Finnhub失败，返回基本数据
        fallback_data = {
            "symbol": symbol.upper(),
            "name": f"{symbol.upper()} Inc.",
            "price": 0,
            "change": 0,
            "changePercent": 0,
            "open": 0,
            "dayHigh": 0,
            "dayLow": 0,
            "volume": 0,
            "marketCap": 0,
            "currency": "USD",
            "exchange": "NASDAQ",
            "industry": "Technology",
            "dataSource": f"Finnhub获取失败，使用默认数据 ({data_source_note})"
        }
        print(f"✗ Finnhub获取失败，使用默认数据")
        return jsonify(fallback_data), 200

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """获取市场股票列表"""
    print(f"\n=== 获取市场股票列表 ===")
    
    # 默认股票列表
    default_symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V']
    
    stocks = []
    for symbol in default_symbols:
        # 获取每支股票的详情
        stock_info, success, _ = get_finnhub_stock_detail(symbol)
        if success:
            stocks.append(stock_info)
        else:
            # 如果获取失败，添加基本数据
            stocks.append({
                "symbol": symbol,
                "name": f"{symbol} Inc.",
                "price": 0,
                "change": 0,
                "changePercent": 0,
                "dataSource": "Finnhub (获取失败)"
            })
    
    response = {
        "stocks": stocks,
        "count": len(stocks),
        "dataSource": "Finnhub (普通展示数据)",
        "timestamp": int(time.time())
    }
    
    print(f"✓ 返回 {len(stocks)} 支股票数据")
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
    print("Twelve Data图表数据源后端启动")
    print(f"图表数据源: Twelve Data")
    print(f"普通展示数据源: Finnhub")
    print(f"端口: 8890")
    print("=" * 80)
    
    app.run(host='127.0.0.1', port=8890, debug=False)