import requests
import json
from datetime import datetime

# 测试3 Months数据
url = "http://127.0.0.1:8890/api/market/history/AAPL"
params = {
    'interval': 'D',
    'range': '3month'
}

print("测试3 Months数据...")
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
            # 显示前10个数据点的日期
            print(f"\n前10个数据点的日期:")
            for i, item in enumerate(historical_data[:10]):
                dt = datetime.fromtimestamp(item['timestamp'])
                print(f"  {i+1}. {dt.strftime('%Y-%m-%d')}: O={item['open']:.2f}, C={item['close']:.2f}")
            
            # 显示最后10个数据点的日期
            print(f"\n最后10个数据点的日期:")
            for i, item in enumerate(historical_data[-10:]):
                dt = datetime.fromtimestamp(item['timestamp'])
                print(f"  {len(historical_data)-9+i}. {dt.strftime('%Y-%m-%d')}: O={item['open']:.2f}, C={item['close']:.2f}")
            
            # 检查日期范围
            timestamps = [item['timestamp'] for item in historical_data]
            earliest = datetime.fromtimestamp(min(timestamps))
            latest = datetime.fromtimestamp(max(timestamps))
            
            print(f"\n=== 日期范围分析 ===")
            print(f"最早日期: {earliest.strftime('%Y-%m-%d')}")
            print(f"最晚日期: {latest.strftime('%Y-%m-%d')}")
            print(f"天数跨度: {(latest - earliest).days} 天")
            
            # 检查是否有重复日期
            dates = [datetime.fromtimestamp(ts).strftime('%Y-%m-%d') for ts in timestamps]
            unique_dates = set(dates)
            
            print(f"\n=== 日期唯一性分析 ===")
            print(f"总数据点: {len(dates)}")
            print(f"唯一日期: {len(unique_dates)}")
            
            if len(dates) != len(unique_dates):
                print(f"⚠️  有重复日期！")
                # 找出重复的日期
                from collections import Counter
                date_counts = Counter(dates)
                duplicates = {date: count for date, count in date_counts.items() if count > 1}
                print(f"重复日期: {duplicates}")
            else:
                print(f"✅ 所有日期都是唯一的")
            
            # 检查日期是否连续
            print(f"\n=== 日期连续性分析 ===")
            date_objects = [datetime.fromtimestamp(ts) for ts in timestamps]
            for i in range(1, min(10, len(date_objects))):
                diff = (date_objects[i] - date_objects[i-1]).days
                print(f"  {date_objects[i-1].strftime('%Y-%m-%d')} → {date_objects[i].strftime('%Y-%m-%d')}: {diff} 天")
            
        else:
            print(f"❌ 没有数据返回")
    else:
        print(f"❌ 请求失败: {response.text}")
        
except Exception as e:
    print(f"❌ 测试失败: {e}")