import requests
import json

# 直接测试Twelve Data API
api_key = '8b847a1ef2aa47a68d3f992bd0275f0c'

# 测试30分钟数据
print("=== 测试Twelve Data 30分钟数据 ===")
url = 'https://api.twelvedata.com/time_series'
params_30min = {
    'symbol': 'AAPL',
    'interval': '30min',
    'outputsize': 50,  # 请求50个点
    'apikey': api_key,
    'format': 'JSON'
}

print(f"请求URL: {url}")
print(f"请求参数: {params_30min}")

response_30min = requests.get(url, params=params_30min, timeout=10)
print(f"响应状态码: {response_30min.status_code}")

if response_30min.status_code == 200:
    data_30min = response_30min.json()
    print(f"响应包含values字段: {'values' in data_30min}")
    
    if 'values' in data_30min:
        values_30min = data_30min['values']
        print(f"30分钟数据点数: {len(values_30min)}")
        
        # 分析时间模式
        print("\n30分钟数据前20个点:")
        minute_counts = {}
        for i, item in enumerate(values_30min[:20]):
            datetime_str = item.get('datetime', 'N/A')
            print(f"  {i+1}. datetime: {datetime_str}")
            
            # 分析分钟部分
            if ':' in datetime_str:
                time_part = datetime_str.split(' ')[1] if ' ' in datetime_str else datetime_str
                minute = time_part.split(':')[1]
                minute_counts[minute] = minute_counts.get(minute, 0) + 1
        
        print(f"\n30分钟数据分钟分布:")
        for minute, count in sorted(minute_counts.items()):
            print(f"  分钟 {minute}: {count}个点")
        
        # 检查是否有:00和:30
        has_00 = '00' in minute_counts
        has_30 = '30' in minute_counts
        print(f"\n包含:00数据: {has_00}")
        print(f"包含:30数据: {has_30}")
        
        # 检查时间范围
        if values_30min:
            print(f"\n时间范围:")
            print(f"  第一个点: {values_30min[0].get('datetime')}")
            print(f"  最后一个点: {values_30min[-1].get('datetime')}")
            
            # 检查日期分布
            date_counts = {}
            for item in values_30min:
                datetime_str = item.get('datetime', '')
                if ' ' in datetime_str:
                    date = datetime_str.split(' ')[0]
                    date_counts[date] = date_counts.get(date, 0) + 1
            
            print(f"\n日期分布 (前10天):")
            for i, (date, count) in enumerate(sorted(date_counts.items(), reverse=True)[:10]):
                print(f"  {date}: {count}个点")
    else:
        print(f"响应数据: {json.dumps(data_30min, indent=2)[:500]}...")
else:
    print(f"请求失败: {response_30min.text}")

# 测试1小时数据对比
print("\n\n=== 测试Twelve Data 1小时数据 ===")
params_1h = {
    'symbol': 'AAPL',
    'interval': '1h',
    'outputsize': 50,
    'apikey': api_key,
    'format': 'JSON'
}

response_1h = requests.get(url, params=params_1h, timeout=10)
print(f"响应状态码: {response_1h.status_code}")

if response_1h.status_code == 200:
    data_1h = response_1h.json()
    
    if 'values' in data_1h:
        values_1h = data_1h['values']
        print(f"1小时数据点数: {len(values_1h)}")
        
        print("\n1小时数据前10个点:")
        minute_counts_1h = {}
        for i, item in enumerate(values_1h[:10]):
            datetime_str = item.get('datetime', 'N/A')
            print(f"  {i+1}. datetime: {datetime_str}")
            
            if ':' in datetime_str:
                time_part = datetime_str.split(' ')[1] if ' ' in datetime_str else datetime_str
                minute = time_part.split(':')[1]
                minute_counts_1h[minute] = minute_counts_1h.get(minute, 0) + 1
        
        print(f"\n1小时数据分钟分布:")
        for minute, count in sorted(minute_counts_1h.items()):
            print(f"  分钟 {minute}: {count}个点")

print("\n=== 总结 ===")
print("1. 如果30分钟数据只有:30，说明Twelve Data API设计如此")
print("2. 如果30分钟数据有:00和:30，说明后端处理有问题")
print("3. 需要根据实际API响应调整前端处理逻辑")