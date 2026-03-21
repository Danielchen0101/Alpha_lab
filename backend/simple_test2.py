import requests

print("测试1 Day数据...")
r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                params={'interval': '60', 'range': '1day'}, 
                timeout=5)
print(f"状态码: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(f"成功! 数据条数: {data.get('count')}")
    print(f"数据源: {data.get('dataSource')}")
else:
    print(f"失败: {r.text[:100]}")

print("\n测试1 Week数据...")
r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                params={'interval': '60', 'range': '1week'}, 
                timeout=5)
print(f"状态码: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(f"成功! 数据条数: {data.get('count')}")
else:
    print(f"失败: {r.text[:100]}")

print("\n测试1 Month数据...")
r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                params={'interval': 'D', 'range': '1month'}, 
                timeout=5)
print(f"状态码: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    print(f"成功! 数据条数: {data.get('count')}")
else:
    print(f"失败: {r.text[:100]}")