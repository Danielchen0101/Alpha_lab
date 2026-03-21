import requests
import json

print("=== 测试Twelve Data outputsize=300 ===")

url = 'https://api.twelvedata.com/time_series'
params = {
    'symbol': 'AAPL',
    'interval': '30min',
    'outputsize': 300,  # 后端请求的数量
    'apikey': '8b847a1ef2aa47a68d3f992bd0275f0c',
    'format': 'JSON'
}

print(f"请求参数: {params}")

response = requests.get(url, params=params, timeout=15)
print(f"响应状态码: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    
    if 'values' in data:
        values = data['values']
        print(f"\nTwelve Data返回数据点数: {len(values)}")
        
        # 分析分钟分布
        minute_counts = {}
        for item in values:
            datetime_str = item.get('datetime', '')
            if ':' in datetime_str:
                time_part = datetime_str.split(' ')[1] if ' ' in datetime_str else datetime_str
                minute = time_part.split(':')[1]
                minute_counts[minute] = minute_counts.get(minute, 0) + 1
        
        print(f"分钟分布: {minute_counts}")
        print(f"有:00数据: {'00' in minute_counts}")
        print(f"有:30数据: {'30' in minute_counts}")
        
        # 打印前20个点
        print(f"\n前20个点:")
        for i, item in enumerate(values[:20]):
            print(f"  {i+1}. {item.get('datetime')}")
        
        # 检查时间范围
        if values:
            print(f"\n时间范围: {values[0].get('datetime')} 到 {values[-1].get('datetime')}")
            
            # 检查是否包含3/13
            has_march13 = any('2026-03-13' in item.get('datetime', '') for item in values)
            print(f"包含3/13数据: {has_march13}")
            
            # 如果包含，显示3/13的数据
            if has_march13:
                march13_data = [item for item in values if '2026-03-13' in item.get('datetime', '')]
                print(f"3/13数据点数: {len(march13_data)}")
                print(f"3/13时间点:")
                for item in march13_data:
                    print(f"  {item.get('datetime')}")
    else:
        print(f"响应数据: {json.dumps(data, indent=2)[:500]}...")
else:
    print(f"请求失败: {response.text}")

print("\n=== 关键问题 ===")
print("如果Twelve Data返回的数据只有:30，那么问题在Twelve Data API")
print("如果Twelve Data返回的数据有:00和:30，那么问题在后端处理")