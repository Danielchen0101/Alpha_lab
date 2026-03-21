import requests

print("测试历史数据接口...")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
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
        print(f"错误: {r.text[:200]}")
except Exception as e:
    print(f"错误: {e}")