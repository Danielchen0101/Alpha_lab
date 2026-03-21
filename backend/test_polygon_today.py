import requests
import json
import time
from datetime import datetime, timedelta

print("直接测试Polygon API今天的数据...")
print("="*80)

POLYGON_API_KEY = 'vx8LMXnMYMpBonwfXE2ssfqSo7WwcnlB'
POLYGON_BASE_URL = 'https://api.polygon.io'

now = datetime.now()
print(f"当前时间: {now}")
print(f"当前日期: {now.strftime('%Y-%m-%d')}")
print()

# 测试1: 今天的小时数据
print("1. 测试今天的小时数据:")
today_start = now.strftime('%Y-%m-%d')
today_end = now.strftime('%Y-%m-%d')

url = f"{POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/range/1/hour/{today_start}/{today_end}"
params = {
    'apiKey': POLYGON_API_KEY,
    'adjusted': 'true',
    'sort': 'asc'
}

print(f"  请求URL: {url}")
print(f"  参数: {params}")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"  状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"  响应状态: {data.get('status')}")
        print(f"  结果数量: {data.get('resultsCount', 0)}")
        print(f"  查询计数: {data.get('queryCount', '未知')}")
        
        if 'results' in data and data['results']:
            results = data['results']
            print(f"  今天数据条数: {len(results)}")
            
            print(f"  今天数据点:")
            for i, result in enumerate(results):
                timestamp_seconds = result['t'] / 1000
                time_str = datetime.fromtimestamp(timestamp_seconds).strftime('%Y-%m-%d %H:%M:%S')
                print(f"    {i+1}. {time_str}: O=${result['o']:.2f}, C=${result['c']:.2f}")
        else:
            print(f"  ⚠️ 今天没有小时数据")
    elif response.status_code == 429:
        print(f"  429 Too Many Requests - 请求频率限制")
    else:
        print(f"  错误: {response.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()

# 测试2: 昨天的数据（对比）
print("2. 测试昨天的数据（对比）:")
yesterday = now - timedelta(days=1)
yesterday_start = yesterday.strftime('%Y-%m-%d')
yesterday_end = yesterday.strftime('%Y-%m-%d')

url_yesterday = f"{POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/range/1/hour/{yesterday_start}/{yesterday_end}"

print(f"  请求URL: {url_yesterday}")

try:
    response = requests.get(url_yesterday, params=params, timeout=10)
    print(f"  状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"  昨天数据条数: {data.get('resultsCount', 0)}")
    else:
        print(f"  错误: {response.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()

# 测试3: 检查Polygon数据延迟
print("3. 检查Polygon数据延迟:")
print("  根据Polygon文档:")
print("  - 免费套餐: 数据有15分钟延迟")
print("  - 付费套餐: 实时数据")
print("  - 小时数据: 可能只在每个小时结束后才可用")
print(f"  当前时间: {now.strftime('%H:%M')}")
print(f"  如果当前时间是 {now.strftime('%H:%M')}，可能还没有 {now.strftime('%H:00')} 的完整小时数据")

print()
print("="*80)
print("结论:")
print("1. 检查Polygon是否返回了今天的数据")
print("2. 检查数据延迟（免费套餐15分钟延迟）")
print("3. 检查是否因为市场未开盘而没有数据")
print("4. 检查时区转换（Polygon使用UTC，美股市场时间）")