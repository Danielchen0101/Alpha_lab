import requests
import json
import time

print("等待服务器启动...")
time.sleep(2)

print("\n=== 测试历史数据接口 ===")
try:
    response = requests.get('http://127.0.0.1:8889/api/market/history/AAPL', 
                          params={'interval': 'D', 'range': '1month'}, 
                          timeout=5)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"成功! 数据条数: {data.get('count')}")
        print(f"数据源: {data.get('dataSource')}")
        print(f"间隔: {data.get('interval')}")
        print(f"范围: {data.get('range')}")
    else:
        print(f"错误: {response.text[:200]}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n=== 测试单股详情接口 ===")
try:
    response = requests.get('http://127.0.0.1:8889/api/market/stock/AAPL', timeout=5)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"成功! 股票: {data.get('symbol')}")
        print(f"价格: {data.get('price')}")
        print(f"涨跌幅: {data.get('changePercent')}%")
    else:
        print(f"错误: {response.text[:200]}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n=== 测试股票列表接口 ===")
try:
    response = requests.get('http://127.0.0.1:8889/api/market/stocks', timeout=5)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"成功! 股票数量: {data.get('count')}")
        print(f"数据源: {data.get('source')}")
    else:
        print(f"错误: {response.text[:200]}")
except Exception as e:
    print(f"请求失败: {e}")