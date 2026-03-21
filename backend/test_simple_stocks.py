import requests

print("简单测试 /api/market/stocks 接口...")

url = 'http://127.0.0.1:8890/api/market/stocks'
print(f"请求URL: {url}")

try:
    response = requests.get(url, timeout=5)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"成功! 股票数量: {data.get('count', 0)}")
        print(f"数据源: {data.get('dataSource', '未知')}")
        
        stocks = data.get('stocks', [])
        if stocks:
            print(f"前3支股票:")
            for i, stock in enumerate(stocks[:3]):
                print(f"  {i+1}. {stock.get('symbol')}: ${stock.get('price', 0):.2f} ({stock.get('changePercent', 0):.2f}%)")
    else:
        print(f"错误: {response.text[:500]}")
        
except Exception as e:
    print(f"请求失败: {e}")
    import traceback
    traceback.print_exc()