import requests
import json
from datetime import datetime, timedelta

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'

print("检查 Price Chart 历史数据 API")
print("=" * 60)

# 1. 测试当前后端 API
print("\n1. 当前后端 API 响应:")
try:
    response = requests.get('http://localhost:8889/api/market/history/AAPL?interval=1day&range=1month', timeout=10)
    print(f"状态码: {response.status_code}")
    data = response.json()
    print(f"数据点数量: {data.get('count', 0)}")
    print(f"数据来源: {data.get('source', 'unknown')}")
    print(f"消息: {data.get('message', 'No message')}")
    print(f"错误: {data.get('error', 'No error')}")
    
    if data.get('data') and len(data['data']) > 0:
        print(f"\n第一个数据点:")
        print(json.dumps(data['data'][0], indent=2))
except Exception as e:
    print(f"错误: {e}")

# 2. 直接测试 Finnhub candle API
print("\n" + "=" * 60)
print("2. 直接测试 Finnhub candle API:")

# 测试不同参数
test_cases = [
    {"range": "1day", "interval": "5", "resolution": "5", "days": 1},
    {"range": "1week", "interval": "1day", "resolution": "D", "days": 7},
    {"range": "1month", "interval": "1day", "resolution": "D", "days": 30},
]

for test in test_cases:
    print(f"\n测试 {test['range']} ({test['interval']}):")
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=test['days'])
    
    url = "https://finnhub.io/api/v1/stock/candle"
    params = {
        'symbol': 'AAPL',
        'resolution': test['resolution'],
        'from': int(start_date.timestamp()),
        'to': int(end_date.timestamp()),
        'token': FINNHUB_API_KEY
    }
    
    print(f"请求参数: {params}")
    
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"响应状态: {data.get('s')}")
        print(f"收盘价数量: {len(data.get('c', []))}")
        print(f"成交量数量: {len(data.get('v', []))}")
        print(f"时间戳数量: {len(data.get('t', []))}")
        
        if data.get('s') == 'ok' and data.get('c'):
            print(f"✅ 有真实数据")
            # 显示一些数据
            print(f"最新数据点: t={data['t'][-1] if data['t'] else 'N/A'}, c={data['c'][-1] if data['c'] else 'N/A'}")
        elif data.get('s') == 'no_data':
            print(f"❌ 无数据 (s='no_data')")
        else:
            print(f"❌ 其他错误: {data}")
    else:
        print(f"❌ API 错误: {response.status_code}")
        print(f"响应: {response.text[:200]}")

# 3. 检查免费 API 限制
print("\n" + "=" * 60)
print("3. Finnhub 免费 API 限制分析:")

print("\n根据测试，Finnhub 免费 API 对 /stock/candle 端点:")
print("✅ 可能支持某些时间范围")
print("❌ 可能返回 403 或 'no_data'")
print("❌ 分钟级数据可能受限")

print("\n可能的解决方案:")
print("1. 使用其他免费 API (Alpha Vantage, Yahoo Finance)")
print("2. 获取 Finnhub 付费 API key")
print("3. 使用缓存的历史数据")
print("4. 实现多数据源回退")

# 4. 检查当前后端实现
print("\n" + "=" * 60)
print("4. 当前后端实现问题:")

print("\n当前问题:")
print("1. 直接返回 403 错误时使用模拟数据")
print("2. 没有尝试其他数据源")
print("3. 没有记录详细的错误信息")

print("\n需要改进:")
print("1. 详细记录 API 错误信息")
print("2. 尝试不同的 resolution 参数")
print("3. 实现多数据源回退机制")
print("4. 明确标记数据真实性")