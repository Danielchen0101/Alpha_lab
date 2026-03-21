import requests
import json

print('=== 测试列表接口中的AAPL数据 ===')
print('请求URL: http://127.0.0.1:8889/api/market/stocks')

try:
    response = requests.get('http://127.0.0.1:8889/api/market/stocks', timeout=10)
    print(f'HTTP状态码: {response.status_code}')
    
    if response.status_code == 200:
        data = response.json()
        stocks = data.get('stocks', [])
        print(f'总股票数量: {len(stocks)}')
        
        # 查找AAPL
        aapl_data = None
        for stock in stocks:
            if stock.get('symbol') == 'AAPL':
                aapl_data = stock
                break
        
        if aapl_data:
            print('\n=== AAPL数据 ===')
            print(f'symbol: {aapl_data.get("symbol")}')
            print(f'name: {aapl_data.get("name")}')
            print(f'price: {aapl_data.get("price")}')
            print(f'change: {aapl_data.get("change")}')
            print(f'changePercent: {aapl_data.get("changePercent")}')
            print(f'dayHigh: {aapl_data.get("dayHigh")}')
            print(f'dayLow: {aapl_data.get("dayLow")}')
            print(f'previousClose: {aapl_data.get("previousClose")}')
            print(f'dataSource: {aapl_data.get("dataSource")}')
            print(f'marketCap: {aapl_data.get("marketCap")}')
            print(f'sector: {aapl_data.get("sector")}')
            print(f'currency: {aapl_data.get("currency")}')
            
            # 检查是否所有必需字段都有值
            required_fields = ['symbol', 'name', 'price', 'change', 'changePercent', 'dayHigh', 'dayLow', 'previousClose', 'dataSource']
            print('\n=== 字段完整性检查 ===')
            for field in required_fields:
                value = aapl_data.get(field)
                if value is not None:
                    print(f'  ✓ {field}: 有值 ({value})')
                else:
                    print(f'  ✗ {field}: 无值')
        else:
            print('AAPL不在返回的股票列表中')
    else:
        print(f'错误响应: {response.text}')
        
except Exception as e:
    print(f'请求失败: {e}')