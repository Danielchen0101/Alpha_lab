"""
直接模拟Flask调用，查看函数返回什么
"""

import sys
import os

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 导入函数
from final_production import get_twelvedata_history

print("=== 直接模拟Flask调用 ===")

# 模拟Flask API的参数
symbol = 'AAPL'
interval = '30min'  # Flask接收的是'30'，但函数内部会转换
range_param = '1week'

print(f"模拟Flask调用参数: symbol={symbol}, interval={interval}, range={range_param}")

# 调用函数
print("\n=== 调用get_twelvedata_history函数 ===")
data, success, note = get_twelvedata_history(symbol, interval, range_param)

print(f"\n=== 函数返回结果 ===")
print(f"success: {success}")
print(f"note: '{note}'")
print(f"数据点数: {len(data)}")

if data:
    # 分析分钟分布
    minute_counts = {}
    for item in data:
        time_str = item.get('time', '')
        if ':' in time_str:
            time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
            minute = time_part.split(':')[1]
            minute_counts[minute] = minute_counts.get(minute, 0) + 1
    
    print(f"分钟分布: {minute_counts}")
    print(f"有:00数据: {'00' in minute_counts}")
    print(f"有:30数据: {'30' in minute_counts}")
    
    # 打印前10个点
    print(f"\n前10个datetime:")
    for i, item in enumerate(data[:10]):
        print(f"  {i+1}. {item.get('time')}")
    
    # 打印后10个点
    if len(data) > 10:
        print(f"\n后10个datetime:")
        start_idx = max(0, len(data) - 10)
        for i, item in enumerate(data[start_idx:]):
            print(f"  {start_idx + i + 1}. {item.get('time')}")
    
    # 检查数据源说明
    if "修复版" in note:
        print("\n✅ 函数返回的是修复版数据")
    else:
        print("\n❌ 函数返回的不是修复版数据")
        
    # 检查数据时间范围
    if data:
        first_time = data[0].get('time', '')
        last_time = data[-1].get('time', '')
        print(f"\n数据时间范围: {first_time} 到 {last_time}")
        
        # 检查是否包含3/13
        has_march13 = any('2026-03-13' in item.get('time', '') for item in data)
        print(f"包含3/13数据: {has_march13}")
        
        # 检查是否包含今天
        has_today = any('2026-03-20' in item.get('time', '') for item in data)
        print(f"包含今天(3/20)数据: {has_today}")
else:
    print("\n❌ 函数没有返回数据")

print("\n=== 关键问题 ===")
print("如果函数返回300个点且有:00和:30，但Flask API返回35个点")
print("那么问题在Flask API route或函数被多次调用")