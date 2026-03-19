import requests
import json
import time

# 等待后端启动
time.sleep(2)

print("=== Testing HTTP Requests to Backend ===")

# 测试健康检查
print("\n1. Testing /api/health")
try:
    response = requests.get("http://localhost:8889/api/health", timeout=5)
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
except Exception as e:
    print(f"   Error: {e}")

# 测试股票列表
print("\n2. Testing /api/market/stocks")
try:
    response = requests.get("http://localhost:8889/api/market/stocks", timeout=5)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Count: {data.get('count')}")
        print(f"   Source: {data.get('source')}")
        print(f"   Has stocks: {'stocks' in data}")
    else:
        print(f"   Response: {response.text[:200]}")
except Exception as e:
    print(f"   Error: {e}")

# 测试单个股票
print("\n3. Testing /api/market/stock/AAPL")
try:
    response = requests.get("http://localhost:8889/api/market/stock/AAPL", timeout=5)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Symbol: {data.get('symbol')}")
        print(f"   Price: {data.get('price')}")
        print(f"   Name: {data.get('name')}")
    else:
        print(f"   Response: {response.text[:200]}")
except Exception as e:
    print(f"   Error: {e}")

# 测试历史数据
print("\n4. Testing /api/market/history/AAPL")
try:
    response = requests.get("http://localhost:8889/api/market/history/AAPL", 
                          params={"interval": "1day", "range": "1month"},
                          timeout=5)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Symbol: {data.get('symbol')}")
        print(f"   Data points: {len(data.get('data', []))}")
        print(f"   Source: {data.get('source')}")
    else:
        print(f"   Response: {response.text[:200]}")
except Exception as e:
    print(f"   Error: {e}")

print("\n=== Testing Complete ===")