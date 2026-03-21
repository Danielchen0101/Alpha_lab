import requests
import json

print("检查当前问题...")

# 1. 检查AAPL单股详情
print("\n1. 检查AAPL单股详情:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
    if r.status_code == 200:
        data = r.json()
        print(f"名称: {data.get('name')}")
        print(f"价格: ${data.get('price')}")
        print(f"市值: ${data.get('marketCap'):,.0f}")
        print(f"数据源: {data.get('dataSource')}")
        print(f"涨跌: ${data.get('change')}")
        print(f"涨跌幅: {data.get('changePercent')}%")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

# 2. 检查历史数据
print("\n2. 检查历史数据:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1month'}, 
                    timeout=10)
    if r.status_code == 200:
        data = r.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"数据条数: {data.get('count')}")
        print(f"备注: {data.get('note', '无')}")
        print(f"是否模拟: {data.get('isSimulated', '未知')}")
        print(f"有实时报价: {data.get('hasRealQuote', '未知')}")
        
        points = data.get('data', [])
        if points:
            closes = [p['close'] for p in points]
            print(f"价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
            print(f"最后收盘价: ${closes[-1]:.2f}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

# 3. 检查股票列表
print("\n3. 检查股票列表:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stocks', timeout=5)
    if r.status_code == 200:
        data = r.json()
        stocks = data.get('stocks', [])
        for stock in stocks[:3]:  # 只看前3个
            print(f"{stock.get('symbol')}: 名称={stock.get('name')}, 市值=${stock.get('marketCap'):,.0f}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n=== 当前问题总结 ===")
print("1. AAPL名称: 显示为'AAPL Company'而不是'Apple Inc'")
print("2. AAPL市值: 显示为$1,000,000,000,000 ($1.0T)而不是实际市值")
print("3. 历史数据: 是模拟数据，不是真实Finnhub candles")
print("4. 数据源描述: 需要准确描述为'混合数据'而不是'真实历史数据'")