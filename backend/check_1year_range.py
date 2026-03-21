import requests
import json
from datetime import datetime, timedelta

# 测试1 Year数据范围
url = "http://127.0.0.1:8890/api/market/history/AAPL"
params = {
    'interval': 'D',
    'range': '1year'
}

print("检查1 Year数据范围...")
print(f"请求URL: {url}")
print(f"参数: {params}")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        historical_data = data.get('data', [])
        
        print(f"\n=== 1 Year数据范围分析 ===")
        print(f"数据总数: {len(historical_data)}")
        
        if len(historical_data) > 0:
            # 第一个和最后一个数据点
            first_point = historical_data[0]
            last_point = historical_data[-1]
            
            print(f"\n第一个数据点:")
            print(f"  time字段: {first_point.get('time', 'N/A')}")
            print(f"  timestamp: {first_point.get('timestamp', 'N/A')}")
            if 'timestamp' in first_point:
                dt = datetime.fromtimestamp(first_point['timestamp'])
                print(f"  转换后日期: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"  本地日期: {dt.strftime('%Y-%m-%d')}")
                dt_utc = datetime.utcfromtimestamp(first_point['timestamp'])
                print(f"  UTC日期: {dt_utc.strftime('%Y-%m-%d %H:%M:%S')}")
            
            print(f"\n最后一个数据点:")
            print(f"  time字段: {last_point.get('time', 'N/A')}")
            print(f"  timestamp: {last_point.get('timestamp', 'N/A')}")
            if 'timestamp' in last_point:
                dt = datetime.fromtimestamp(last_point['timestamp'])
                print(f"  转换后日期: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"  本地日期: {dt.strftime('%Y-%m-%d')}")
                dt_utc = datetime.utcfromtimestamp(last_point['timestamp'])
                print(f"  UTC日期: {dt_utc.strftime('%Y-%m-%d %H:%M:%S')}")
            
            # 检查time字段的日期
            print(f"\n=== time字段分析 ===")
            print(f"第一个time: '{first_point.get('time', '')}'")
            print(f"最后一个time: '{last_point.get('time', '')}'")
            
            # 检查所有time字段的日期
            dates = [item.get('time', '') for item in historical_data]
            unique_dates = sorted(set(dates))
            print(f"\n所有唯一日期 (前10个和后10个):")
            print(f"前10个: {unique_dates[:10]}")
            print(f"后10个: {unique_dates[-10:]}")
            
            # 检查是否有3月19日的数据
            has_0319 = any('2026-03-19' in date for date in dates)
            print(f"\n是否有2026-03-19的数据: {has_0319}")
            if has_0319:
                mar19_data = [item for item in historical_data if '2026-03-19' in item.get('time', '')]
                print(f"2026-03-19的数据点数量: {len(mar19_data)}")
                if mar19_data:
                    print(f"2026-03-19的数据: {mar19_data[0]}")
            
            # 检查是否有3月18日的数据
            has_0318 = any('2026-03-18' in date for date in dates)
            print(f"\n是否有2026-03-18的数据: {has_0318}")
            if has_0318:
                mar18_data = [item for item in historical_data if '2026-03-18' in item.get('time', '')]
                print(f"2026-03-18的数据点数量: {len(mar18_data)}")
            
            # 今天的日期
            today = datetime.now()
            print(f"\n=== 今天日期 ===")
            print(f"当前时间: {today.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"当前日期: {today.strftime('%Y-%m-%d')}")
            
        else:
            print(f"没有数据返回")
    else:
        print(f"请求失败: {response.text}")
        
except Exception as e:
    print(f"测试失败: {e}")