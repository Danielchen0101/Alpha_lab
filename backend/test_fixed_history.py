import requests
from datetime import datetime
import time

print("测试修复后的历史数据接口...")
time.sleep(2)

print("\n1. 测试AAPL 1 Month数据:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1month'}, 
                    timeout=10)
    print(f"状态码: {r.status_code}")
    
    if r.status_code == 200:
        data = r.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"数据条数: {data.get('count')}")
        
        if 'warning' in data:
            print(f"警告: {data.get('warning')}")
        
        data_points = data.get('data', [])
        if data_points:
            print(f"\n前3个点:")
            for i, point in enumerate(data_points[:3]):
                time_str = datetime.fromtimestamp(point['timestamp']).strftime('%Y-%m-%d')
                print(f"  {i+1}. 时间: {time_str}, C: {point['close']:.2f}")
            
            print(f"\n后3个点:")
            for i, point in enumerate(data_points[-3:]):
                time_str = datetime.fromtimestamp(point['timestamp']).strftime('%Y-%m-%d')
                print(f"  {i+1}. 时间: {time_str}, C: {point['close']:.2f}")
            
            closes = [p['close'] for p in data_points]
            print(f"\n价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
            print(f"最后收盘价: ${closes[-1]:.2f}")
    else:
        print(f"错误: {r.text[:200]}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n2. 测试AAPL单股详情:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
    if r.status_code == 200:
        data = r.json()
        print(f"当前价格: ${data.get('price')}")
        print(f"数据源: {data.get('dataSource')}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n3. 检查价格一致性:")
print("页面主价格应该和图表最后一个close价格基本一致")
print("如果使用真实数据，价格应该在$240+范围")
print("如果使用模拟数据，应该明确标记")