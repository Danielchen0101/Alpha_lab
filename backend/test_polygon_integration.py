import requests
import time
import json

print("=== Testing Polygon Integration ===")
print("Waiting for backend to start...")
time.sleep(3)

# 测试单个股票
print("\n1. Testing /api/market/stock/AAPL")
try:
    response = requests.get("http://localhost:8889/api/market/stock/AAPL", timeout=10)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Symbol: {data.get('symbol')}")
        print(f"   Price: {data.get('price')}")
        print(f"   Name: {data.get('name')}")
        print(f"   Data Source: {data.get('dataSource', 'Not specified')}")
        print(f"   Has Polygon data: {'Polygon' in str(data.get('dataSource', ''))}")
    else:
        print(f"   Response: {response.text[:200]}")
except Exception as e:
    print(f"   Error: {e}")

# 测试历史数据
print("\n2. Testing /api/market/history/AAPL")
try:
    response = requests.get("http://localhost:8889/api/market/history/AAPL", 
                          params={"interval": "1day", "range": "1month"},
                          timeout=10)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Symbol: {data.get('symbol')}")
        print(f"   Data points: {len(data.get('data', []))}")
        print(f"   Source: {data.get('source')}")
        print(f"   Has Polygon data: {'Polygon' in str(data.get('source', ''))}")
    else:
        print(f"   Response: {response.text[:200]}")
except Exception as e:
    print(f"   Error: {e}")

# 测试股票列表
print("\n3. Testing /api/market/stocks")
try:
    response = requests.get("http://localhost:8889/api/market/stocks", timeout=10)
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   Count: {data.get('count')}")
        print(f"   Source: {data.get('source')}")
        print(f"   Has Polygon data: {'Polygon' in str(data.get('source', ''))}")
        if data.get('stocks') and len(data['stocks']) > 0:
            first_stock = data['stocks'][0]
            print(f"   First stock data source: {first_stock.get('dataSource', 'Not specified')}")
    else:
        print(f"   Response: {response.text[:200]}")
except Exception as e:
    print(f"   Error: {e}")

print("\n=== Testing Complete ===")