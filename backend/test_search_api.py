import requests
import json

url = 'http://127.0.0.1:8889/api/market/search'
params = {'q': 'AAPL'}

print('Testing backend search API...')
try:
    response = requests.get(url, params=params, timeout=10)
    print(f'Status code: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        print(f'Data source: {data.get("source", "unknown")}')
        print(f'Result count: {data.get("count", 0)}')
        
        results = data.get('results', [])
        if results:
            print('Search results:')
            for i, result in enumerate(results[:3]):
                print(f'  {i+1}. {result.get("symbol")} - {result.get("name")}')
    else:
        print(f'Response: {response.text[:200]}')
        
except Exception as e:
    print(f'Error: {e}')