import requests
import json
import time

print("Testing final /api/market/stock/AAPL endpoint (complete data):")
print("Waiting for backend to start...")
time.sleep(3)

print("\n1. Testing /api/market/stock/AAPL:")
try:
    response = requests.get('http://localhost:8889/api/market/stock/AAPL', timeout=10)
    print(f'Status: {response.status_code}')
    data = response.json()
    print(f'Response keys: {list(data.keys())}')
    print(f'Name: {data.get("name")}')
    print(f'Price: {data.get("price")}')
    print(f'Market Cap: {data.get("marketCap")}')
    print(f'Sector: {data.get("sector")}')
    print(f'P/E Ratio: {data.get("peRatio")}')
    print(f'Dividend Yield: {data.get("dividendYield")}')
    print(f'52 Week High: {data.get("yearHigh")}')
    print(f'52 Week Low: {data.get("yearLow")}')
except Exception as e:
    print(f'Error: {e}')

print("\n2. Testing /api/market/history/AAPL (with fallback):")
try:
    response = requests.get('http://localhost:8889/api/market/history/AAPL?interval=1day&range=1month', timeout=10)
    print(f'Status: {response.status_code}')
    data = response.json()
    print(f'Count: {data.get("count", 0)}')
    print(f'Source: {data.get("source", "unknown")}')
    print(f'Message: {data.get("message", "No message")}')
    
    if data.get('data') and len(data['data']) > 0:
        print(f'First 3 data points:')
        for i in range(min(3, len(data['data']))):
            item = data['data'][i]
            print(f'  {i+1}: date={item.get("time", "")[:10]}, O={item.get("open")}, H={item.get("high")}, L={item.get("low")}, C={item.get("close")}, V={item.get("volume")}')
except Exception as e:
    print(f'Error: {e}')

print("\n3. Testing different timeframes:")
timeframes = [
    ('1day', '5min'),
    ('1week', '1day'),
    ('1month', '1day'),
    ('3month', '1day'),
    ('1year', '1day')
]

for range_param, interval in timeframes[:2]:  # Test first 2 to avoid too many calls
    print(f'\n  Testing {range_param} with {interval} interval:')
    try:
        response = requests.get(f'http://localhost:8889/api/market/history/AAPL?interval={interval}&range={range_param}', timeout=10)
        data = response.json()
        print(f'    Count: {data.get("count", 0)} data points')
        print(f'    Source: {data.get("source", "unknown")}')
    except Exception as e:
        print(f'    Error: {e}')