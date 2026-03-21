import requests
import json

print("=== 测试修复后的后端正式接口 ===")

# 测试1 Week 30min数据
url = "http://localhost:8890/api/market/history/AAPL"
params = {
    'range': '1week',
    'interval': '30min'
}

print(f"请求URL: {url}")
print(f"请求参数: {params}")

response = requests.get(url, params=params, timeout=15)
print(f"响应状态码: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    
    if 'data' in data:
        values = data['data']
        print(f"\n后端正式返回数据点数: {len(values)}")
        
        # 分析分钟分布
        minute_counts = {}
        for item in values:
            time_str = item.get('time', '')
            if ':' in time_str:
                time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
                minute = time_part.split(':')[1]
                minute_counts[minute] = minute_counts.get(minute, 0) + 1
        
        print(f"分钟分布: {minute_counts}")
        print(f"有:00数据: {'00' in minute_counts}")
        print(f"有:30数据: {'30' in minute_counts}")
        
        # 打印前20个点
        print(f"\n前20个点:")
        for i, item in enumerate(values[:20]):
            print(f"  {i+1}. {item.get('time')}")
        
        # 打印后20个点
        if len(values) > 20:
            print(f"\n后20个点:")
            start_idx = max(0, len(values) - 20)
            for i, item in enumerate(values[start_idx:]):
                print(f"  {start_idx + i + 1}. {item.get('time')}")
        
        # 检查数据完整性
        print(f"\n=== 数据完整性检查 ===")
        
        # 检查是否包含3/13
        has_march13 = any('2026-03-13' in item.get('time', '') for item in values)
        print(f"包含3/13数据: {has_march13}")
        
        if has_march13:
            march13_data = [item for item in values if '2026-03-13' in item.get('time', '')]
            print(f"3/13数据点数: {len(march13_data)}")
            print(f"3/13时间点:")
            for item in march13_data:
                print(f"  {item.get('time')}")
        
        # 检查是否包含今天
        has_today = any('2026-03-20' in item.get('time', '') for item in values)
        print(f"包含今天(3/20)数据: {has_today}")
        
        if has_today:
            today_data = [item for item in values if '2026-03-20' in item.get('time', '')]
            print(f"今天数据点数: {len(today_data)}")
            print(f"今天时间点:")
            for item in today_data:
                print(f"  {item.get('time')}")
        
        # 检查是否有16:00
        has_1600 = any('16:00:00' in item.get('time', '') for item in values)
        print(f"包含16:00数据: {has_1600}")
        
        if has_1600:
            sixteen_data = [item for item in values if '16:00:00' in item.get('time', '')]
            print(f"16:00数据点数: {len(sixteen_data)}")
            for item in sixteen_data:
                print(f"  {item.get('time')}")
    else:
        print(f"响应数据格式: {json.dumps(data, indent=2)[:500]}...")
else:
    print(f"请求失败: {response.text}")

print("\n=== 修复结果 ===")
print("如果分钟分布同时包含:00和:30，则修复成功")
print("如果数据点数接近300，则获取了完整数据")