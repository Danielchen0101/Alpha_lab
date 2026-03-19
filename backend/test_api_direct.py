import requests
import sys

print("直接测试API端点...")

# 测试健康检查
print("\n1. 测试健康检查:")
try:
    response = requests.get("http://localhost:8889/api/health")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
except Exception as e:
    print(f"   Error: {e}")

# 测试股票列表
print("\n2. 测试股票列表:")
try:
    response = requests.get("http://localhost:8889/api/market/stocks")
    print(f"   Status: {response.status_code}")
    data = response.json()
    print(f"   Count: {data.get('count')}")
    print(f"   Source: {data.get('source')}")
except Exception as e:
    print(f"   Error: {e}")

# 测试单个股票
print("\n3. 测试单个股票 (AAPL):")
try:
    response = requests.get("http://localhost:8889/api/market/stock/AAPL")
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
print("\n4. 测试历史数据 (AAPL):")
try:
    response = requests.get("http://localhost:8889/api/market/history/AAPL", params={"interval": "1day", "range": "1month"})
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Data points: {len(data.get('data', []))}")
        print(f"   Source: {data.get('source')}")
    else:
        print(f"   Response: {response.text[:200]}")
except Exception as e:
    print(f"   Error: {e}")