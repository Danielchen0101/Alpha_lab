import requests
import time
import json

print("=== 测试修复后的后端API ===")
print("等待后端启动...")
time.sleep(3)

# 测试健康检查
print("\n1. 测试健康检查:")
try:
    response = requests.get("http://127.0.0.1:8889/api/health", timeout=5)
    print(f"   状态: {response.status_code}")
    print(f"   响应: {response.json()}")
except Exception as e:
    print(f"   错误: {e}")

# 测试单个股票
print("\n2. 测试单个股票 (AAPL):")
try:
    response = requests.get("http://127.0.0.1:8889/api/market/stock/AAPL", timeout=10)
    print(f"   状态: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   股票: {data.get('symbol')}")
        print(f"   名称: {data.get('name')}")
        print(f"   价格: {data.get('price')}")
        print(f"   数据源: {data.get('dataSource')}")
        print(f"   涨跌幅: {data.get('changePercent')}%")
        print(f"   市值: {data.get('marketCap')}")
        print(f"   行业: {data.get('sector')}")
    else:
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"   错误: {e}")

# 测试历史数据
print("\n3. 测试历史数据 (AAPL, 1M):")
try:
    response = requests.get("http://127.0.0.1:8889/api/market/history/AAPL", 
                          params={"range": "1M"},
                          timeout=10)
    print(f"   状态: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   股票: {data.get('symbol')}")
        print(f"   数据点数: {data.get('count')}")
        print(f"   数据源: {data.get('source')}")
        print(f"   时间范围: {data.get('range')}")
        if data.get('data') and len(data['data']) > 0:
            first_point = data['data'][0]
            print(f"   第一个数据点: 时间={first_point.get('timestamp')}, 收盘价={first_point.get('close')}")
    else:
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"   错误: {e}")

# 测试股票列表
print("\n4. 测试股票列表:")
try:
    response = requests.get("http://127.0.0.1:8889/api/market/stocks", 
                          params={"symbols": "AAPL,MSFT,TSLA"},
                          timeout=10)
    print(f"   状态: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   股票数量: {data.get('count')}")
        print(f"   数据源: {data.get('source')}")
        stocks = data.get('stocks', [])
        for stock in stocks:
            print(f"   - {stock.get('symbol')}: ${stock.get('price')} ({stock.get('sector')})")
    else:
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"   错误: {e}")

print("\n=== 测试完成 ===")