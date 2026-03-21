import requests
import json

print("=== 综合测试：找出:00数据丢失的原因 ===\n")

# 1. 直接测试Twelve Data API
print("1. 直接测试Twelve Data 30min API:")
url_td = 'https://api.twelvedata.com/time_series'
params_td = {
    'symbol': 'AAPL',
    'interval': '30min',
    'outputsize': 50,
    'apikey': '8b847a1ef2aa47a68d3f992bd0275f0c',
    'format': 'JSON'
}

response_td = requests.get(url_td, params=params_td, timeout=10)
if response_td.status_code == 200:
    data_td = response_td.json()
    if 'values' in data_td:
        values_td = data_td['values']
        print(f"  Twelve Data原始数据点数: {len(values_td)}")
        
        # 分析分钟分布
        minute_counts_td = {}
        for item in values_td[:30]:  # 只分析前30个点
            datetime_str = item.get('datetime', '')
            if ':' in datetime_str:
                time_part = datetime_str.split(' ')[1] if ' ' in datetime_str else datetime_str
                minute = time_part.split(':')[1]
                minute_counts_td[minute] = minute_counts_td.get(minute, 0) + 1
        
        print(f"  Twelve Data分钟分布: {minute_counts_td}")
        print(f"  有:00数据: {'00' in minute_counts_td}")
        print(f"  有:30数据: {'30' in minute_counts_td}")
        
        # 打印前10个点的时间
        print(f"  Twelve Data前10个点:")
        for i, item in enumerate(values_td[:10]):
            print(f"    {i+1}. {item.get('datetime')}")
else:
    print(f"  Twelve Data API请求失败: {response_td.status_code}")

# 2. 测试后端API
print("\n2. 测试后端API (interval=30min):")
url_backend = "http://localhost:8890/api/market/history/AAPL?range=1week&interval=30min"
response_backend = requests.get(url_backend, timeout=10)

if response_backend.status_code == 200:
    data_backend = response_backend.json()
    values_backend = data_backend.get('data', [])
    print(f"  后端返回数据点数: {len(values_backend)}")
    
    # 分析分钟分布
    minute_counts_backend = {}
    for item in values_backend[:30]:
        time_str = item.get('time', '')
        if ':' in time_str:
            time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
            minute = time_part.split(':')[1]
            minute_counts_backend[minute] = minute_counts_backend.get(minute, 0) + 1
    
    print(f"  后端分钟分布: {minute_counts_backend}")
    print(f"  有:00数据: {'00' in minute_counts_backend}")
    print(f"  有:30数据: {'30' in minute_counts_backend}")
    
    # 打印前10个点的时间
    print(f"  后端前10个点:")
    for i, item in enumerate(values_backend[:10]):
        print(f"    {i+1}. {item.get('time')}")
else:
    print(f"  后端API请求失败: {response_backend.status_code}")

# 3. 测试后端API (不指定interval，使用默认)
print("\n3. 测试后端API (使用默认interval):")
url_backend_default = "http://localhost:8890/api/market/history/AAPL?range=1week"
response_backend_default = requests.get(url_backend_default, timeout=10)

if response_backend_default.status_code == 200:
    data_backend_default = response_backend_default.json()
    values_backend_default = data_backend_default.get('data', [])
    print(f"  后端默认返回数据点数: {len(values_backend_default)}")
    
    # 分析分钟分布
    minute_counts_default = {}
    for item in values_backend_default[:30]:
        time_str = item.get('time', '')
        if ':' in time_str:
            time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
            minute = time_part.split(':')[1]
            minute_counts_default[minute] = minute_counts_default.get(minute, 0) + 1
    
    print(f"  后端默认分钟分布: {minute_counts_default}")
    
    # 打印前10个点的时间
    print(f"  后端默认前10个点:")
    for i, item in enumerate(values_backend_default[:10]):
        print(f"    {i+1}. {item.get('time')}")

# 4. 分析问题
print("\n4. 问题分析:")
print("  a) 如果Twelve Data有:00和:30，但后端只有:30 → 后端处理问题")
print("  b) 如果Twelve Data只有:30 → Twelve Data API问题")
print("  c) 如果后端默认和30min返回相同 → 1 Week强制使用30min")

# 5. 检查数据完整性
print("\n5. 数据完整性检查:")
if 'values_td' in locals() and 'values_backend' in locals():
    print(f"  Twelve Data总点数: {len(values_td)}")
    print(f"  后端返回总点数: {len(values_backend)}")
    
    # 检查时间范围
    if values_td and values_backend:
        print(f"  Twelve Data时间范围: {values_td[0].get('datetime')} 到 {values_td[-1].get('datetime')}")
        print(f"  后端时间范围: {values_backend[0].get('time')} 到 {values_backend[-1].get('time')}")
        
        # 检查是否包含3/13 09:30
        has_target_start = any('2026-03-13 09:30' in str(item.get('datetime', '')) for item in values_td)
        print(f"  Twelve Data包含3/13 09:30: {has_target_start}")
        
        has_target_start_backend = any('2026-03-13 09:30' in str(item.get('time', '')) for item in values_backend)
        print(f"  后端包含3/13 09:30: {has_target_start_backend}")

print("\n=== 结论 ===")
print("需要查看后端日志确认:")
print("1. 后端是否真的请求了30min数据")
print("2. Twelve Data返回了什么")
print("3. 后端处理过程中是否丢失了:00数据")