import requests

print("测试不在STOCK_DATA中的股票...")
r = requests.get('http://127.0.0.1:8890/api/market/history/XYZ', 
                params={'interval': 'D', 'range': '1month'}, 
                timeout=5)
if r.status_code == 200:
    data = r.json()
    print(f"数据源: {data.get('dataSource')}")
    points = data.get('data', [])
    if points:
        closes = [p['close'] for p in points]
        print(f"价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
        print(f"基础价格: 100 (默认值)")
        print(f"模拟波动: ±5美元")
        print(f"预期范围: $95 - $105")
else:
    print(f"错误: {r.status_code}")