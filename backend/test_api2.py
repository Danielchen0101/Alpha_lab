import requests
import time

# 测试带symbols参数的API
url = 'http://127.0.0.1:8889/api/market/stocks'
params = {'symbols': 'AAPL,MSFT,GOOGL'}

print('Testing API with symbols parameter...')
start = time.time()

try:
    response = requests.get(url, params=params, timeout=15)
    elapsed = time.time() - start
    
    print(f'Response time: {elapsed:.2f} seconds')
    print(f'Status code: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        print(f'Stock count: {data.get("count", 0)}')
        print(f'Data source: {data.get("source", "unknown")}')
        
        stocks = data.get('stocks', [])
        if stocks:
            print('Stocks retrieved:')
            for stock in stocks:
                print(f'  {stock.get("symbol")}: ${stock.get("price")}')
    else:
        print(f'Response: {response.text[:200]}')
        
except Exception as e:
    print(f'Error: {e}')