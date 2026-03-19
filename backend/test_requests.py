import requests
import time

# 等待后端启动
time.sleep(2)

urls = [
    "http://localhost:8889/api/health",
    "http://localhost:8889/api/market/stocks",
    "http://localhost:8889/api/market/stock/AAPL",
    "http://localhost:8889/api/market/history/AAPL?interval=1day&range=1month"
]

for url in urls:
    print(f"\n测试: {url}")
    try:
        response = requests.get(url, timeout=5)
        print(f"  状态: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            if 'symbol' in data:
                print(f"  股票: {data.get('symbol')}, 价格: {data.get('price')}")
            elif 'count' in data:
                print(f"  数量: {data.get('count')}, 来源: {data.get('source')}")
            else:
                print(f"  响应: {str(data)[:100]}...")
        else:
            print(f"  错误: {response.text[:200]}")
    except requests.exceptions.Timeout:
        print("  超时")
    except Exception as e:
        print(f"  异常: {e}")