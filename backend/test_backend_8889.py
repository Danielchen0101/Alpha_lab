import requests
import json
import time

print("测试8889端口后端连通性...")
print(f"后端地址: http://127.0.0.1:8889")
print()

# 测试1: /api/health 或 /api/status
print("1. 测试 /api/status:")
try:
    r = requests.get('http://127.0.0.1:8889/api/status', timeout=5)
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
    r = requests.get('http://127.0.0.1:8889/api/market/stocks', params={'dashboard': 'true'}, timeout=5)
    print(f"   状态码: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"   股票数量: {data.get('count', 0)}")
        print(f"   数据源: {data.get('source', '未知')}")
    else:
        print(f"   错误: {r.text[:200]}")
except Exception as e:
    print(f"   请求失败: {e}")

print()

# 测试3: /api/market/history/AAPL
print("3. 测试 /api/market/history/AAPL:")
try:
    r = requests.get('http://127.0.0.1:8889/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1month'}, 
                    timeout=10)
    print(f"   状态码: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"   数据源: {data.get('dataSource')}")
        print(f"   数据条数: {data.get('count', 0)}")
        print(f"   是否真实数据: {data.get('isRealData', '未知')}")
    else:
        print(f"   错误: {r.text[:200]}")
except Exception as e:
    print(f"   请求失败: {e}")

print()

# 测试4: /api/market/stock/AAPL
print("4. 测试 /api/market/stock/AAPL:")
try:
    r = requests.get('http://127.0.0.1:8889/api/market/stock/AAPL', timeout=5)
    print(f"   状态码: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"   名称: {data.get('name')}")
        print(f"   价格: ${data.get('price')}")
        print(f"   数据源: {data.get('dataSource')}")
    else:
        print(f"   错误: {r.text[:200]}")
except Exception as e:
    print(f"   请求失败: {e}")

print()
print("="*60)
print("总结:")
print("如果所有接口都返回200状态码，说明8889端口后端工作正常")
print("前端代理应该配置为: http://127.0.0.1:8889")