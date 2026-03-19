import requests
import json
import time

print("Testing updated /api/market/stock/AAPL endpoint (with all three Finnhub APIs):")
print("Waiting for backend to start...")
time.sleep(3)

try:
    response = requests.get('http://localhost:8889/api/market/stock/AAPL', timeout=10)
    print(f'Status: {response.status_code}')
    print(f'Response: {json.dumps(response.json(), indent=2)}')
except Exception as e:
    print(f'Error: {e}')

print()
print("Testing /api/market/history/AAPL endpoint (checking for 403 issue):")
try:
    response = requests.get('http://localhost:8889/api/market/history/AAPL?interval=1day&range=1month', timeout=10)
    print(f'Status: {response.status_code}')
    data = response.json()
    print(f'Response: {json.dumps(data, indent=2)}')
except Exception as e:
    print(f'Error: {e}')