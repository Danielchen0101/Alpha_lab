import requests
import json

print('=== 简单API测试 ===')
try:
    response = requests.get('http://localhost:8889/api/market/history/AAPL?interval=D&range=3month', timeout=10)
    print(f'Status Code: {response.status_code}')
    
    data = response.json()
    print(f'Count: {data.get("count")}')
    print(f'Data length: {len(data.get("data", []))}')
    print(f'DataSource: {data.get("dataSource")}')
    print(f'Note: {data.get("note")}')
    
    if data.get('data') and len(data['data']) > 0:
        print(f'First item: {data["data"][0]}')
    else:
        print('No data returned')
        
except Exception as e:
    print(f'Error: {e}')