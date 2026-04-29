import sys
import os

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入后端函数
from start_quant_backend import get_twelvedata_history

print("测试完整的后端get_twelvedata_history函数")
print("="*80)

# 测试1: 1个月日线数据
print("\n测试1: 1个月日线数据 (interval=D, range=1month)")
try:
    historical_data, success, note = get_twelvedata_history('AAPL', 'D', '1month')
    print(f"成功: {success}")
    print(f"备注: {note}")
    print(f"数据点数: {len(historical_data)}")
    
    if historical_data:
        print(f"前3个数据点:")
        for i, item in enumerate(historical_data[:3]):
            print(f"  {i+1}. 时间: {item.get('time')}, 收盘价: {item.get('close')}")
    else:
        print("没有返回数据")
        
except Exception as e:
    print(f"函数调用异常: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "="*80 + "\n")

# 测试2: 1周小时数据
print("测试2: 1周小时数据 (interval=60, range=1week)")
try:
    historical_data, success, note = get_twelvedata_history('AAPL', '60', '1week')
    print(f"成功: {success}")
    print(f"备注: {note}")
    print(f"数据点数: {len(historical_data)}")
    
    if historical_data:
        print(f"前3个数据点:")
        for i, item in enumerate(historical_data[:3]):
            print(f"  {i+1}. 时间: {item.get('time')}, 收盘价: {item.get('close')}")
    else:
        print("没有返回数据")
        
except Exception as e:
    print(f"函数调用异常: {e}")
    import traceback
    traceback.print_exc()