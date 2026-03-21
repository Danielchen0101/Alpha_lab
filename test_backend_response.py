import requests
import json

# 测试后端API响应
print("=== 测试后端API响应 ===")

# 测试1: 30min间隔
print("\n1. 测试 interval=30min:")
url_30min = "http://localhost:8890/api/market/history/AAPL?range=1week&interval=30min"
print(f"请求URL: {url_30min}")

response_30min = requests.get(url_30min, timeout=10)
print(f"响应状态码: {response_30min.status_code}")

if response_30min.status_code == 200:
    data_30min = response_30min.json()
    print(f"数据点数: {len(data_30min.get('data', []))}")
    
    # 分析返回的数据
    if 'data' in data_30min and data_30min['data']:
        values_30min = data_30min['data']
        print(f"\n前20个返回数据点:")
        
        minute_counts = {}
        for i, item in enumerate(values_30min[:20]):
            time_str = item.get('time', 'N/A')
            print(f"  {i+1}. time: {time_str}")
            
            # 分析分钟部分
            if ':' in time_str:
                time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
                minute = time_part.split(':')[1]
                minute_counts[minute] = minute_counts.get(minute, 0) + 1
        
        print(f"\n分钟分布:")
        for minute, count in sorted(minute_counts.items()):
            print(f"  分钟 {minute}: {count}个点")
        
        # 检查时间范围
        if values_30min:
            print(f"\n时间范围:")
            print(f"  第一个点: {values_30min[0].get('time')}")
            print(f"  最后一个点: {values_30min[-1].get('time')}")
    else:
        print(f"响应数据: {json.dumps(data_30min, indent=2)[:500]}...")
else:
    print(f"请求失败: {response_30min.text}")

# 测试2: 检查后端是否真的调用了Twelve Data 30min
print("\n\n2. 检查后端日志（需要查看控制台）")
print("   如果后端日志显示请求30min但返回只有:30，说明Twelve Data API问题")
print("   如果后端日志显示请求1h，说明参数映射有问题")

# 测试3: 直接比较原始数据和后端返回
print("\n\n3. 直接比较:")
print("   - 原始Twelve Data 30min数据: 有:00和:30")
print("   - 后端返回数据: 需要检查分钟分布")
print("   - 如果后端返回只有:30，说明处理链路有问题")