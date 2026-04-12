import sys
import os

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

print("=== 完整调用链测试 ===")
print("针对 AAPL + 1Month")

# 1. 前端实际 selectedTimeframe 是什么
print("\n1. 前端实际 selectedTimeframe: '1M'")

# 2. TIMEFRAMES['1M'] 映射后的 interval/range 是什么
print("\n2. TIMEFRAMES['1M'] 映射:")
print("   根据前端代码，TIMEFRAMES['1M'] = { interval: 'D', range: '1month', dataPoints: 20, label: '1 Month' }")
print("   所以前端会发送: interval='D', range='1month'")

# 3. 导入后端函数进行测试
print("\n3. 测试后端 get_twelvedata_history 函数...")
try:
    from start_quant_backend import get_twelvedata_history
    
    # 模拟后端接收的参数
    symbol = 'AAPL'
    interval = 'D'  # 从前端传来
    range_param = '1month'  # 从前端传来
    
    print(f"   调用 get_twelvedata_history('{symbol}', '{interval}', '{range_param}')")
    
    historical_data, success, data_source_note = get_twelvedata_history(symbol, interval, range_param)
    
    print(f"   结果:")
    print(f"     success: {success}")
    print(f"     note: '{data_source_note}'")
    print(f"     数据点数: {len(historical_data)}")
    
    if historical_data:
        print(f"     前3个数据点:")
        for i, item in enumerate(historical_data[:3]):
            print(f"       {i+1}. 时间: {item.get('time')}, 收盘价: {item.get('close')}")
    else:
        print(f"     没有数据返回")
        
except Exception as e:
    print(f"   测试失败: {e}")
    import traceback
    traceback.print_exc()

# 4. 测试后端API路由
print("\n4. 测试后端API路由...")
import requests
import json

url = "http://127.0.0.1:8889/api/market/history/AAPL"
params = {'interval': 'D', 'range': '1month'}

try:
    response = requests.get(url, params=params, timeout=30)
    print(f"   状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   响应:")
        print(f"     count: {data.get('count', 0)}")
        print(f"     dataSource: {data.get('dataSource', 'N/A')}")
        print(f"     note: {data.get('note', 'N/A')}")
        print(f"     warning: {data.get('warning', 'N/A')}")
        
        if data.get('count', 0) > 0:
            print(f"     有 {data['count']} 个数据点")
        else:
            print(f"     没有数据")
    else:
        print(f"   HTTP错误: {response.status_code}")
        print(f"   响应: {response.text[:500]}")
        
except Exception as e:
    print(f"   请求异常: {e}")

print("\n=== 测试完成 ===")