import requests
import json
import time
from datetime import datetime, timedelta
import pytz

print("测试Finnhub今天的intraday数据...")
print("="*80)

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

# 测试1: 获取今天的分钟数据
print("1. 测试Finnhub分钟数据接口:")
symbol = 'AAPL'

# 计算时间范围：今天开盘到现在
now = datetime.now()
ny_tz = pytz.timezone('America/New_York')
now_ny = ny_tz.localize(now)

# 今天开盘时间：09:30 NY时间
today_open = now_ny.replace(hour=9, minute=30, second=0, microsecond=0)

# 转换为Unix时间戳
from_timestamp = int(today_open.timestamp())
to_timestamp = int(now_ny.timestamp())

print(f"  当前时间 (NY): {now_ny.strftime('%Y-%m-%d %H:%M:%S')}")
print(f"  今天开盘时间: {today_open.strftime('%Y-%m-%d %H:%M:%S')}")
print(f"  时间范围: {from_timestamp} 到 {to_timestamp}")
print(f"  持续时间: {(to_timestamp - from_timestamp)/3600:.1f}小时")

# Finnhub candle接口
url = f"{FINNHUB_BASE_URL}/stock/candle"
params = {
    'symbol': symbol,
    'resolution': '1',  # 1分钟数据
    'from': from_timestamp,
    'to': to_timestamp,
    'token': FINNHUB_API_KEY
}

print(f"\n  请求参数:")
print(f"    URL: {url}")
print(f"    Symbol: {symbol}")
print(f"    Resolution: 1 (分钟)")
print(f"    From: {from_timestamp} ({datetime.fromtimestamp(from_timestamp).strftime('%Y-%m-%d %H:%M:%S')})")
print(f"    To: {to_timestamp} ({datetime.fromtimestamp(to_timestamp).strftime('%Y-%m-%d %H:%M:%S')})")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"\n  响应状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"  响应数据:")
        print(f"    Status: {data.get('s')}")
        print(f"    数据点数量: {len(data.get('c', [])) if 'c' in data else 0}")
        
        if data.get('s') == 'ok' and 'c' in data and len(data['c']) > 0:
            closes = data['c']
            opens = data['o']
            highs = data['h']
            lows = data['l']
            volumes = data['v']
            timestamps = data['t']
            
            print(f"\n  数据详情:")
            print(f"    时间戳数量: {len(timestamps)}")
            print(f"    收盘价数量: {len(closes)}")
            print(f"    开盘价数量: {len(opens)}")
            print(f"    最高价数量: {len(highs)}")
            print(f"    最低价数量: {len(lows)}")
            
            # 显示前5个数据点
            print(f"\n  前5个数据点:")
            for i in range(min(5, len(timestamps))):
                ts = timestamps[i]
                dt = datetime.fromtimestamp(ts)
                print(f"    {i+1}. {dt.strftime('%Y-%m-%d %H:%M:%S')}:")
                print(f"        O=${opens[i]:.2f}, H=${highs[i]:.2f}, L=${lows[i]:.2f}, C=${closes[i]:.2f}")
                print(f"        Volume: {volumes[i]:,}")
            
            # 显示最后5个数据点
            print(f"\n  最后5个数据点:")
            for i in range(max(0, len(timestamps)-5), len(timestamps)):
                ts = timestamps[i]
                dt = datetime.fromtimestamp(ts)
                print(f"    {i+1}. {dt.strftime('%Y-%m-%d %H:%M:%S')}:")
                print(f"        O=${opens[i]:.2f}, H=${highs[i]:.2f}, L=${lows[i]:.2f}, C=${closes[i]:.2f}")
                print(f"        Volume: {volumes[i]:,}")
            
            # 分析价格范围
            if closes:
                min_price = min(closes)
                max_price = max(closes)
                avg_price = sum(closes) / len(closes)
                print(f"\n  价格分析:")
                print(f"    最低价: ${min_price:.2f}")
                print(f"    最高价: ${max_price:.2f}")
                print(f"    平均价: ${avg_price:.2f}")
                print(f"    价格范围: ${min_price:.2f} - ${max_price:.2f}")
                
                # 检查是否在合理范围
                if min_price < 240 or max_price > 260:
                    print(f"    ⚠️ 价格可能不在合理范围 (AAPL当前应在$249-$251附近)")
                else:
                    print(f"    ✓ 价格在合理范围")
            
            # 尝试聚合为小时数据
            print(f"\n  尝试聚合为小时数据:")
            if timestamps:
                # 按小时分组
                hourly_data = {}
                for i in range(len(timestamps)):
                    ts = timestamps[i]
                    dt = datetime.fromtimestamp(ts)
                    hour_key = dt.strftime('%Y-%m-%d %H:00')
                    
                    if hour_key not in hourly_data:
                        hourly_data[hour_key] = {
                            'timestamps': [],
                            'opens': [],
                            'highs': [],
                            'lows': [],
                            'closes': [],
                            'volumes': []
                        }
                    
                    hourly_data[hour_key]['timestamps'].append(ts)
                    hourly_data[hour_key]['opens'].append(opens[i])
                    hourly_data[hour_key]['highs'].append(highs[i])
                    hourly_data[hour_key]['lows'].append(lows[i])
                    hourly_data[hour_key]['closes'].append(closes[i])
                    hourly_data[hour_key]['volumes'].append(volumes[i])
                
                print(f"    小时分组: {len(hourly_data)}个")
                for hour_key in sorted(hourly_data.keys())[:5]:  # 显示前5个小时
                    data = hourly_data[hour_key]
                    if data['opens']:
                        hour_open = data['opens'][0]  # 该小时第一分钟的开盘价
                        hour_close = data['closes'][-1]  # 该小时最后一分钟的收盘价
                        hour_high = max(data['highs'])
                        hour_low = min(data['lows'])
                        hour_volume = sum(data['volumes'])
                        
                        print(f"    {hour_key}:")
                        print(f"      数据点: {len(data['timestamps'])}分钟")
                        print(f"      O=${hour_open:.2f}, H=${hour_high:.2f}, L=${hour_low:.2f}, C=${hour_close:.2f}")
                        print(f"      Volume: {hour_volume:,}")
        else:
            print(f"  错误: {data.get('s')}")
            print(f"  完整响应: {json.dumps(data, indent=2)}")
    else:
        print(f"  HTTP错误: {response.status_code}")
        print(f"  响应: {response.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("2. 测试Finnhub报价接口（对比）:")
print("获取当前实时报价，与intraday数据对比")

quote_url = f"{FINNHUB_BASE_URL}/quote"
quote_params = {
    'symbol': symbol,
    'token': FINNHUB_API_KEY
}

try:
    quote_response = requests.get(quote_url, params=quote_params, timeout=5)
    if quote_response.status_code == 200:
        quote_data = quote_response.json()
        print(f"  当前报价:")
        print(f"    当前价格: ${quote_data.get('c', 0):.2f}")
        print(f"    今日开盘: ${quote_data.get('o', 0):.2f}")
        print(f"    今日最高: ${quote_data.get('h', 0):.2f}")
        print(f"    今日最低: ${quote_data.get('l', 0):.2f}")
        print(f"    前日收盘: ${quote_data.get('pc', 0):.2f}")
    else:
        print(f"  报价请求失败: {quote_response.status_code}")
        
except Exception as e:
    print(f"  报价请求失败: {e}")