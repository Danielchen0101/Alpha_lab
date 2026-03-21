import requests
import time
from datetime import datetime, timedelta

print("=== 测试Polygon API ===")

POLYGON_API_KEY = 'vx8LMXnMYMpBonwfXE2ssfqSo7WwcnlB'
POLYGON_BASE_URL = 'https://api.polygon.io'

# 测试1: 检查API密钥有效性
print("\n1. 测试API密钥有效性...")
try:
    url = f"{POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/range/1/day/2026-03-01/2026-03-19"
    params = {
        'apiKey': POLYGON_API_KEY,
        'adjusted': 'true',
        'sort': 'asc'
    }
    
    print(f"请求URL: {url}")
    print(f"API密钥: {POLYGON_API_KEY[:8]}...{POLYGON_API_KEY[-4:]}")
    
    response = requests.get(url, params=params, timeout=10)
    
    print(f"状态码: {response.status_code}")
    print(f"响应头: {dict(response.headers)}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"成功! 获取到AAPL历史数据:")
        print(f"  结果数量: {data.get('resultsCount', 0)}")
        print(f"  状态: {data.get('status', '未知')}")
        
        if 'results' in data and data['results']:
            results = data['results']
            print(f"  数据条数: {len(results)}")
            print(f"  第一条数据:")
            print(f"    时间: {datetime.fromtimestamp(results[0]['t']/1000).strftime('%Y-%m-%d')}")
            print(f"    开盘: ${results[0]['o']}")
            print(f"    最高: ${results[0]['h']}")
            print(f"    最低: ${results[0]['l']}")
            print(f"    收盘: ${results[0]['c']}")
            print(f"    交易量: {results[0]['v']}")
            
            print(f"  最后一条数据:")
            print(f"    时间: {datetime.fromtimestamp(results[-1]['t']/1000).strftime('%Y-%m-%d')}")
            print(f"    收盘: ${results[-1]['c']}")
    elif response.status_code == 403:
        print("❌ API密钥无效或被限制")
        print(f"响应内容: {response.text}")
    else:
        print(f"其他错误: {response.status_code}")
        print(f"响应内容: {response.text[:500]}")
        
except Exception as e:
    print(f"请求失败: {e}")
    import traceback
    traceback.print_exc()

# 测试2: 测试不同时间范围
print("\n2. 测试不同时间范围...")
test_cases = [
    {"desc": "1天数据 (分钟级)", "url": "/v2/aggs/ticker/AAPL/range/1/minute/2026-03-18/2026-03-19"},
    {"desc": "1周数据 (日级)", "url": "/v2/aggs/ticker/AAPL/range/1/day/2026-03-12/2026-03-19"},
    {"desc": "1月数据 (日级)", "url": "/v2/aggs/ticker/AAPL/range/1/day/2026-02-19/2026-03-19"},
    {"desc": "1年数据 (日级)", "url": "/v2/aggs/ticker/AAPL/range/1/day/2025-03-19/2026-03-19"},
]

for test in test_cases:
    print(f"\n测试: {test['desc']}")
    try:
        url = f"{POLYGON_BASE_URL}{test['url']}"
        params = {
            'apiKey': POLYGON_API_KEY,
            'adjusted': 'true',
            'sort': 'asc'
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if 'results' in data and data['results']:
                results = data['results']
                print(f"  成功获取 {len(results)} 条数据")
                print(f"  价格范围: ${min(r['l'] for r in results):.2f} - ${max(r['h'] for r in results):.2f}")
                print(f"  最后收盘: ${results[-1]['c']:.2f}")
            else:
                print(f"  无数据返回")
        elif response.status_code == 429:
            print(f"  请求频率限制")
        else:
            print(f"  错误: {response.status_code}")
    except Exception as e:
        print(f"  请求失败: {e}")

# 测试3: 测试实时报价
print("\n3. 测试实时报价...")
try:
    url = f"{POLYGON_BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers/AAPL"
    params = {
        'apiKey': POLYGON_API_KEY
    }
    
    response = requests.get(url, params=params, timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        print(f"成功! 获取到AAPL实时快照:")
        if 'ticker' in data:
            ticker = data['ticker']
            print(f"  最新价格: ${ticker.get('lastTrade', {}).get('p', 'N/A')}")
            print(f"  涨跌: ${ticker.get('todaysChange', 'N/A')}")
            print(f"  涨跌幅: {ticker.get('todaysChangePerc', 'N/A')}%")
            print(f"  今日最高: ${ticker.get('day', {}).get('h', 'N/A')}")
            print(f"  今日最低: ${ticker.get('day', {}).get('l', 'N/A')}")
    else:
        print(f"错误: {response.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n=== 结论 ===")
print("如果Polygon API工作正常，我们可以:")
print("1. 使用Polygon作为历史数据主源")
print("2. 使用Finnhub作为实时报价主源")
print("3. 实现双源fallback策略")