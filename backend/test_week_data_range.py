import requests
import json
import time
from datetime import datetime, timedelta

print("测试1 Week数据范围...")
print("="*80)

POLYGON_API_KEY = 'vx8LMXnMYMpBonwfXE2ssfqSo7WwcnlB'
POLYGON_BASE_URL = 'https://api.polygon.io'

# 模拟后端逻辑
now = datetime.now()
print(f"当前时间: {now}")
print(f"当前时间 (ISO): {now.isoformat()}")
print()

# 测试1: 当前后端逻辑
print("1. 当前后端逻辑 (可能有问题):")
days_back = 7  # 1 week
end_date = now.strftime('%Y-%m-%d')
start_date = (now - timedelta(days=days_back)).strftime('%Y-%m-%d')
resolution = 'hour'  # 1 Week使用小时数据

url = f"{POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/range/1/{resolution}/{start_date}/{end_date}"
params = {
    'apiKey': POLYGON_API_KEY,
    'adjusted': 'true',
    'sort': 'asc'
}

print(f"  请求URL: {url}")
print(f"  开始日期: {start_date}")
print(f"  结束日期: {end_date}")
print(f"  问题: 结束日期只到今天的日期，不包含具体时间")
print()

# 测试2: 修复后的逻辑
print("2. 修复后的逻辑 (应该包含今天完整数据):")
# 对于小时数据，我们需要包含完整的时间范围
# 结束时间应该是当前时间，而不是今天的日期
end_date_fixed = now.strftime('%Y-%m-%d')
# 但Polygon API对于小时数据，需要指定具体的日期范围
# 让我们测试不同的结束时间策略

# 策略A: 使用当前时间作为结束时间
print("策略A: 使用当前日期作为结束日期")
url_a = f"{POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/range/1/hour/{start_date}/{end_date_fixed}"
print(f"  URL: {url_a}")

# 策略B: 检查Polygon是否支持包含今天部分数据
print("\n策略B: 检查今天是否有数据")
# 先测试今天的数据
today_start = now.strftime('%Y-%m-%d')
today_end = now.strftime('%Y-%m-%d')
url_today = f"{POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/range/1/hour/{today_start}/{today_end}"
print(f"  今天数据URL: {url_today}")

print()
print("="*80)
print("问题分析:")
print("1. Polygon API对于小时数据，返回的是完整的小时bar")
print("2. 如果今天还没结束，可能只有部分小时数据")
print("3. 需要检查缓存是否导致拿到旧数据")
print("4. 需要检查时区处理 (Polygon使用UTC时间)")

# 实际测试
print("\n实际测试当前后端返回的数据:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': '60', 'range': '1week'}, 
                    timeout=15)
    
    print(f"状态码: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"数据条数: {data.get('count', 0)}")
        
        points = data.get('data', [])
        if points:
            print(f"数据时间范围:")
            first = points[0]
            last = points[-1]
            
            first_time = datetime.fromtimestamp(first['timestamp']).strftime('%Y-%m-%d %H:%M:%S')
            last_time = datetime.fromtimestamp(last['timestamp']).strftime('%Y-%m-%d %H:%M:%S')
            
            print(f"  最早: {first_time}")
            print(f"  最晚: {last_time}")
            print(f"  今天日期: {now.strftime('%Y-%m-%d')}")
            
            # 检查是否包含今天的数据
            today_data = [p for p in points if datetime.fromtimestamp(p['timestamp']).date() == now.date()]
            print(f"  今天数据条数: {len(today_data)}")
            
            if today_data:
                print(f"  今天数据时间点:")
                for p in today_data[-5:]:  # 显示最后5个今天的数据点
                    time_str = datetime.fromtimestamp(p['timestamp']).strftime('%H:%M')
                    print(f"    {time_str}: ${p['close']:.2f}")
            else:
                print(f"  ⚠️ 没有今天的数据!")
    else:
        print(f"错误: {r.text[:200]}")
        
except Exception as e:
    print(f"请求失败: {e}")