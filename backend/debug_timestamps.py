import requests
import json
from datetime import datetime

# 测试后端返回的原始时间戳
url = "http://127.0.0.1:8890/api/market/history/AAPL"
params = {
    'interval': 'D',
    'range': '3month'
}

print("测试后端返回的3 Months数据时间戳...")

try:
    response = requests.get(url, params=params, timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        historical_data = data.get('data', [])
        
        print(f"数据总数: {len(historical_data)}")
        
        if len(historical_data) > 0:
            # 显示前5个数据点的原始时间戳和转换后的日期
            print(f"\n前5个数据点的原始时间戳:")
            for i, item in enumerate(historical_data[:5]):
                timestamp = item['timestamp']
                dt_utc = datetime.utcfromtimestamp(timestamp)
                dt_local = datetime.fromtimestamp(timestamp)
                print(f"  {i+1}. timestamp: {timestamp}")
                print(f"     UTC时间: {dt_utc.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"     本地时间: {dt_local.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"     datetime_str: {item.get('time', 'N/A')}")
            
            # 检查时间戳是否相同
            timestamps = [item['timestamp'] for item in historical_data]
            unique_timestamps = set(timestamps)
            
            print(f"\n=== 时间戳分析 ===")
            print(f"总数据点: {len(timestamps)}")
            print(f"唯一时间戳: {len(unique_timestamps)}")
            
            if len(unique_timestamps) <= 5:
                print(f"唯一时间戳列表: {sorted(list(unique_timestamps))[:10]}")
            
            # 检查时间戳对应的日期
            print(f"\n=== 时间戳对应日期 ===")
            dates_utc = [datetime.utcfromtimestamp(ts).strftime('%Y-%m-%d') for ts in timestamps]
            dates_local = [datetime.fromtimestamp(ts).strftime('%Y-%m-%d') for ts in timestamps]
            
            unique_dates_utc = set(dates_utc)
            unique_dates_local = set(dates_local)
            
            print(f"UTC日期: {len(unique_dates_utc)} 个唯一日期")
            print(f"本地日期: {len(unique_dates_local)} 个唯一日期")
            
            if len(unique_dates_utc) <= 5:
                print(f"UTC日期列表: {sorted(list(unique_dates_utc))}")
            if len(unique_dates_local) <= 5:
                print(f"本地日期列表: {sorted(list(unique_dates_local))}")
            
            # 检查时间戳是否递增
            print(f"\n=== 时间戳顺序 ===")
            is_sorted = all(timestamps[i] <= timestamps[i+1] for i in range(len(timestamps)-1))
            print(f"时间戳是否递增: {is_sorted}")
            
            if not is_sorted:
                print(f"时间戳顺序问题!")
                for i in range(min(5, len(timestamps)-1)):
                    if timestamps[i] > timestamps[i+1]:
                        print(f"  索引 {i}: {timestamps[i]} > {timestamps[i+1]}")
            
        else:
            print(f"没有数据返回")
    else:
        print(f"请求失败: {response.status_code}")
        
except Exception as e:
    print(f"测试失败: {e}")