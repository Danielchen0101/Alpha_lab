import requests
import json
from datetime import datetime

# 模拟前端请求3 Months数据
url = "http://127.0.0.1:8890/api/market/history/AAPL"
params = {
    'interval': 'D',
    'range': '3month'
}

print("检查3 Months数据（模拟前端视角）...")
print(f"请求URL: {url}")
print(f"参数: {params}")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        historical_data = data.get('data', [])
        
        print(f"\n=== 3 Months数据点分析 ===")
        print(f"数据总数: {len(historical_data)}")
        
        if len(historical_data) > 0:
            # 检查前10个数据点的date字段
            print(f"\n前10个数据点的结构:")
            for i, item in enumerate(historical_data[:10]):
                print(f"\n数据点 {i+1}:")
                print(f"  所有字段: {list(item.keys())}")
                print(f"  time字段: {item.get('time', 'N/A')}")
                print(f"  timestamp字段: {item.get('timestamp', 'N/A')}")
                
                # 检查是否有date字段（前端使用的字段）
                if 'date' in item:
                    print(f"  date字段: {item['date']}")
                else:
                    print(f"  date字段: 不存在")
                    
                # 检查时间戳对应的日期
                if 'timestamp' in item:
                    ts = item['timestamp']
                    dt_local = datetime.fromtimestamp(ts)
                    dt_utc = datetime.utcfromtimestamp(ts)
                    print(f"  时间戳 {ts} 对应:")
                    print(f"    本地时间: {dt_local.strftime('%Y-%m-%d %H:%M:%S')}")
                    print(f"    UTC时间: {dt_utc.strftime('%Y-%m-%d %H:%M:%S')}")
            
            # 检查所有数据点的time字段是否相同
            print(f"\n=== time字段分析 ===")
            times = [item.get('time', '') for item in historical_data]
            unique_times = set(times)
            print(f"唯一time值数量: {len(unique_times)}")
            
            if len(unique_times) <= 5:
                print(f"所有time值: {sorted(list(unique_times))}")
            else:
                print(f"前5个time值: {sorted(list(unique_times))[:5]}")
                print(f"后5个time值: {sorted(list(unique_times))[-5:]}")
            
            # 检查是否有date字段
            print(f"\n=== date字段分析 ===")
            dates_in_data = []
            for item in historical_data:
                if 'date' in item:
                    dates_in_data.append(item['date'])
            
            if dates_in_data:
                unique_dates = set(dates_in_data)
                print(f"date字段存在，唯一值数量: {len(unique_dates)}")
                if len(unique_dates) <= 5:
                    print(f"所有date值: {sorted(list(unique_dates))}")
            else:
                print(f"date字段不存在于数据中")
                
        else:
            print(f"没有数据返回")
    else:
        print(f"请求失败: {response.text}")
        
except Exception as e:
    print(f"测试失败: {e}")