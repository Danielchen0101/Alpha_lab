import requests
import json
import time

# 测试1D图API
url = "http://localhost:8892/api/market/history/AAPL"
params = {
    "interval": "5min",
    "range": "1day"
}

print("=== 测试1D图API ===")
print(f"请求URL: {url}")
print(f"请求参数: {params}")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"响应状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"数据点数: {data.get('count')}")
        
        if data.get('data') and len(data['data']) > 0:
            first = data['data'][0]
            last = data['data'][-1]
            print(f"第一个点: time={first.get('time')}, timestamp={first.get('timestamp')}")
            print(f"最后一个点: time={last.get('time')}, timestamp={last.get('timestamp')}")
            
            # 转换时间显示
            import datetime
            first_dt = datetime.datetime.fromtimestamp(first['timestamp'], datetime.timezone.utc)
            last_dt = datetime.datetime.fromtimestamp(last['timestamp'], datetime.timezone.utc)
            print(f"第一个点(UTC): {first_dt}")
            print(f"最后一个点(UTC): {last_dt}")
            
            # 转换为美东时间
            import pytz
            eastern = pytz.timezone('America/New_York')
            first_edt = first_dt.astimezone(eastern)
            last_edt = last_dt.astimezone(eastern)
            print(f"第一个点(EDT): {first_edt}")
            print(f"最后一个点(EDT): {last_edt}")
    else:
        print(f"响应错误: {response.text[:200]}")
        
except Exception as e:
    print(f"请求异常: {e}")