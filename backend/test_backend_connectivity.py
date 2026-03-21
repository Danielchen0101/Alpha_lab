import requests
import json
import time

print("测试后端连通性...")
print(f"后端地址: http://127.0.0.1:8890")
print()

# 测试1: /api/status
print("1. 测试 /api/status:")
try:
    r = requests.get('http://127.0.0.1:8890/api/status', timeout=5)
    print(f"   状态码: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"   响应: {json.dumps(data, indent=2, ensure_ascii=False)}")
    else:
        print(f"   错误: {r.text[:200]}")
except Exception as e:
    print(f"   请求失败: {e}")

print()

# 测试2: /api/market/stocks
print("2. 测试 /api/market/stocks:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stocks', params={'dashboard': 'true'}, timeout=5)
    print(f"   状态码: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"   股票数量: {data.get('count', 0)}")
        print(f"   数据源: {data.get('source', '未知')}")
        stocks = data.get('stocks', [])
        if stocks:
            print(f"   前3支股票:")
            for i, stock in enumerate(stocks[:3]):
                print(f"     {i+1}. {stock.get('symbol')}: ${stock.get('price')}")
    else:
        print(f"   错误: {r.text[:200]}")
except Exception as e:
    print(f"   请求失败: {e}")

print()

# 测试3: /api/market/history/AAPL
print("3. 测试 /api/market/history/AAPL:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1month'}, 
                    timeout=10)
    print(f"   状态码: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"   数据源: {data.get('dataSource')}")
        print(f"   数据条数: {data.get('count', 0)}")
        print(f"   是否真实数据: {data.get('isRealData', '未知')}")
        
        points = data.get('data', [])
        if points:
            print(f"   前3个数据点:")
            for i, p in enumerate(points[:3]):
                time_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(p['timestamp']))
                print(f"     {i+1}. {time_str}: O=${p['open']:.2f}, H=${p['high']:.2f}, L=${p['low']:.2f}, C=${p['close']:.2f}")
    else:
        print(f"   错误: {r.text[:200]}")
except Exception as e:
    print(f"   请求失败: {e}")

print()

# 测试4: /api/market/stock/AAPL
print("4. 测试 /api/market/stock/AAPL:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
    print(f"   状态码: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"   名称: {data.get('name')}")
        print(f"   价格: ${data.get('price')}")
        print(f"   涨跌: ${data.get('change')}")
        print(f"   涨跌幅: {data.get('changePercent')}%")
        print(f"   数据源: {data.get('dataSource')}")
    else:
        print(f"   错误: {r.text[:200]}")
except Exception as e:
    print(f"   请求失败: {e}")

print()
print("="*60)
print("总结:")
print("如果所有接口都返回200状态码，说明后端工作正常")
print("前端代理应该配置为: http://127.0.0.1:8890")