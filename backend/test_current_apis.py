import requests
import json

print("Testing current /api/market/stock/AAPL endpoint:")
try:
    response = requests.get('http://localhost:8889/api/market/stock/AAPL', timeout=10)
    print(f'Status: {response.status_code}')
    print(f'Response: {json.dumps(response.json(), indent=2)}')
except Exception as e:
    print(f'Error: {e}')

print()
print("Testing /api/market/history/AAPL endpoint:")
try:
    response = requests.get('http://localhost:8889/api/market/history/AAPL?interval=1day&range=1month', timeout=10)
    print(f'Status: {response.status_code}')
    data = response.json()
    print(f'Count: {data.get("count", 0)}')
    if data.get('data'):
        print(f'First data point: {json.dumps(data["data"][0], indent=2) if data["data"] else "No data"}')
except Exception as e:
    print(f'Error: {e}')