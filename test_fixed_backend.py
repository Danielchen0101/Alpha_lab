import requests
import json

print("=== 测试修复后的后端 ===")

# 测试后端API
url = "http://localhost:8890/api/market/history/AAPL?range=1week&interval=30min"
print(f"请求URL: {url}")

response = requests.get(url, timeout=15)
print(f"响应状态码: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    values = data.get('data', [])
    print(f"\n后端返回数据点数: {len(values)}")
    
    # 分析分钟分布
    minute_counts = {}
    for item in values:
        time_str = item.get('time', '')
        if ':' in time_str:
            time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
            minute = time_part.split(':')[1]
            minute_counts[minute] = minute_counts.get(minute, 0) + 1
    
    print(f"后端分钟分布: {minute_counts}")
    print(f"有:00数据: {'00' in minute_counts}")
    print(f"有:30数据: {'30' in minute_counts}")
    
    # 打印前20个点
    print(f"\n后端前20个点:")
    for i, item in enumerate(values[:20]):
        print(f"  {i+1}. {item.get('time')}")
    
    # 打印后20个点
    if len(values) > 20:
        print(f"\n后端后20个点:")
        for i, item in enumerate(values[-20:]):
            print(f"  {len(values)-19+i}. {item.get('time')}")
    
    # 检查是否包含完整的30分钟序列
    print(f"\n=== 检查30分钟序列完整性 ===")
    
    # 检查3/13的数据
    march13_data = [item for item in values if '2026-03-13' in item.get('time', '')]
    print(f"3/13数据点数: {len(march13_data)}")
    if march13_data:
        print(f"3/13时间点:")
        for item in march13_data:
            print(f"  {item.get('time')}")
    
    # 检查今天的数据
    from datetime import datetime
    today_str = datetime.now().strftime('%Y-%m-%d')
    today_data = [item for item in values if today_str in item.get('time', '')]
    print(f"\n今天({today_str})数据点数: {len(today_data)}")
    if today_data:
        print(f"今天时间点:")
        for item in today_data:
            print(f"  {item.get('time')}")
    
    # 检查是否有16:00数据
    has_1600 = any('16:00' in item.get('time', '') for item in values)
    print(f"\n有16:00数据: {has_1600}")
    
    # 检查时间范围
    if values:
        print(f"\n时间范围: {values[0].get('time')} 到 {values[-1].get('time')}")
        
        # 检查是否从3/13 09:30开始
        first_time = values[0].get('time', '')
        starts_correctly = '2026-03-13 09:30' in first_time
        print(f"从3/13 09:30开始: {starts_correctly}")
        
        # 检查数据连续性
        print(f"\n=== 数据连续性检查 ===")
        date_counts = {}
        for item in values:
            time_str = item.get('time', '')
            if ' ' in time_str:
                date = time_str.split(' ')[0]
                date_counts[date] = date_counts.get(date, 0) + 1
        
        print(f"日期分布:")
        for date, count in sorted(date_counts.items()):
            print(f"  {date}: {count}个点")
            
            # 检查每天是否有完整的14个点
            if count < 14:
                print(f"   警告: {date}只有{count}个点，预期14个点")
else:
    print(f"请求失败: {response.text}")

print("\n=== 预期结果 ===")
print("1. 后端应该返回:00和:30数据")
print("2. 应该从3/13 09:30开始")
print("3. 应该包含完整的30分钟序列")
print("4. 每天应该有14个点（09:30-16:00）")