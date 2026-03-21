"""
直接测试修复后的函数
"""

import sys
import os

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 导入函数
from final_production import get_twelvedata_history

print("=== 直接测试修复后的get_twelvedata_history函数 ===")

# 测试1 Week 30min数据
symbol = 'AAPL'
interval = '30min'
range_param = '1week'

print(f"参数: symbol={symbol}, interval={interval}, range={range_param}")

# 调用函数
data, success, note = get_twelvedata_history(symbol, interval, range_param)

print(f"\n函数返回:")
print(f"  success: {success}")
print(f"  note: {note}")
print(f"  数据点数: {len(data)}")

if data:
    # 分析分钟分布
    minute_counts = {}
    for item in data[:100]:  # 只分析前100个
        time_str = item.get('time', '')
        if ':' in time_str:
            time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
            minute = time_part.split(':')[1]
            minute_counts[minute] = minute_counts.get(minute, 0) + 1
    
    print(f"  分钟分布: {minute_counts}")
    print(f"  有:00数据: {'00' in minute_counts}")
    print(f"  有:30数据: {'30' in minute_counts}")
    
    # 打印前10个点
    print(f"\n  前10个点:")
    for i, item in enumerate(data[:10]):
        print(f"    {i+1}. {item.get('time')}")
    
    # 检查数据源说明
    if "修复版" in note:
        print("\n✅ 使用的是修复版函数")
    else:
        print("\n❌ 可能使用的是旧版函数")
else:
    print("\n❌ 没有返回数据")

print("\n=== 重要检查 ===")
print("1. 函数是否打印了'1 Week：使用30分钟数据，请求300个点（修复版）'")
print("2. 函数是否打印了'原始数据分钟分布'包含:00和:30")
print("3. 函数是否打印了'处理后分钟分布'包含:00和:30")
print("4. 返回的note是否包含'修复版'")