import requests
import json

url = 'http://127.0.0.1:8889/api/market/stocks'

print('Testing /api/market/stocks API...')
print('=' * 60)

try:
    response = requests.get(url, timeout=15)
    print(f'Status code: {response.status_code}')
    print(f'Content-Type: {response.headers.get("Content-Type")}')
    print('=' * 60)
    
    if response.status_code == 200:
        data = response.json()
        
        # 打印完整响应结构
        print('Full response structure:')
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print('=' * 60)
        
        # 分析结构
        print('Response analysis:')
        print(f'1. Top-level keys: {list(data.keys())}')
        print(f'2. Has "stocks" key: {"stocks" in data}')
        print(f'3. Has "data" key: {"data" in data}')
        
        if 'stocks' in data:
            stocks = data['stocks']
            print(f'4. "stocks" is array: {isinstance(stocks, list)}')
            print(f'5. "stocks" length: {len(stocks)}')
            
            if stocks and len(stocks) > 0:
                print(f'6. First stock keys: {list(stocks[0].keys())}')
                print(f'7. First stock sample:')
                first_stock = stocks[0]
                for key, value in first_stock.items():
                    print(f'   - {key}: {value}')
        else:
            print('4. No "stocks" key found')
            
        print(f'8. Source field: {data.get("source", "Not found")}')
        print(f'9. Count field: {data.get("count", "Not found")}')
        
    else:
        print(f'Response: {response.text[:500]}')
        
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()