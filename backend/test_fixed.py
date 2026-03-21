import requests
import time

print("等待新后端启动...")
time.sleep(3)

print("\n测试修改后的历史数据接口...")
r = requests.get('http://127.0.0.1:8889/api/market/history/AAPL', 
                params={'interval': 'D', 'range': '1month'}, 
                timeout=5)
print(f"状态码: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(f"成功! 数据条数: {data.get('count')}")
    print(f"数据源: {data.get('dataSource')}")
    print(f"间隔: {data.get('interval')}")
    print(f"范围: {data.get('range')}")
else:
    print(f"失败: {r.text[:100]}")

print("\n测试1 Day数据...")
r = requests.get('http://127.0.0.1:8889/api/market/history/AAPL', 
                params={'interval': '60', 'range': '1day'}, 
                timeout=5)
print(f"状态码: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(f"成功! 数据条数: {data.get('count')}")

print("\n测试1 Week数据...")
r = requests.get('http://127.0.0.1:8889/api/market/history/AAPL', 
                params={'interval': '60', 'range': '1week'}, 
                timeout=5)
print(f"状态码: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(f"成功! 数据条数: {data.get('count')}")