import sys
import os
import requests
import json

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

print("=== 1 Week真实数据链路测试 ===")
print("针对 AAPL + 1 Week")

# 1. 前端实际请求参数
print("\n1. 前端实际请求参数:")
print("   根据TIMEFRAMES配置: '1W': { interval: '60', range: '1week', dataPoints: 40, label: '1 Week' }")
print("   所以前端会发送: interval='60', range='1week'")

# 2. 测试后端API路由
print("\n2. 测试后端API路由...")
url = "http://127.0.0.1:8889/api/market/history/AAPL"
params = {'interval': '60', 'range': '1week'}

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
            print(f"\n3. 前5条原始数据:")
            for i, item in enumerate(data.get('data', [])[:5]):
                print(f"     {i+1}. 时间字段:")
                print(f"         time: '{item.get('time', 'N/A')}'")
                print(f"         timestamp: {item.get('timestamp', 'N/A')}")
                print(f"         open: {item.get('open', 'N/A')}")
                print(f"         high: {item.get('high', 'N/A')}")
                print(f"         low: {item.get('low', 'N/A')}")
                print(f"         close: {item.get('close', 'N/A')}")
                print(f"         volume: {item.get('volume', 'N/A')}")
                
                # 检查时间字段是否有效
                time_field = item.get('time')
                if time_field:
                    try:
                        # 尝试解析time字段
                        if ' ' in time_field:
                            # 格式: "2026-03-20 16:00:00"
                            date_str = time_field.replace(' ', 'T') + 'Z'
                        else:
                            # 格式: "2026-03-20"
                            date_str = time_field + 'T00:00:00Z'
                        
                        date_obj = date_str
                        print(f"         time字段解析: {date_str}")
                    except Exception as e:
                        print(f"         time字段解析失败: {e}")
        else:
            print(f"     没有数据")
    else:
        print(f"   HTTP错误: {response.status_code}")
        print(f"   响应: {response.text[:500]}")
        
except Exception as e:
    print(f"   请求异常: {e}")
    import traceback
    traceback.print_exc()

# 3. 直接测试Twelve Data API
print("\n4. 直接测试Twelve Data API...")
try:
    from start_quant_backend import get_twelvedata_history
    
    symbol = 'AAPL'
    interval = '60'  # 60分钟间隔
    range_param = '1week'  # 1周范围
    
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
            print(f"           原始time字段: '{item.get('time')}'")
            print(f"           timestamp: {item.get('timestamp')}")
    else:
        print(f"     没有数据返回")
        
except Exception as e:
    print(f"   测试失败: {e}")
    import traceback
    traceback.print_exc()

print("\n=== 测试完成 ===")