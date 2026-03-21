import requests
import json
import time

print("=== 测试Flask API Route详细调试 ===")

# 测试1 Week 30min数据
url = "http://localhost:8890/api/market/history/AAPL"
params = {
    'range': '1week',
    'interval': '30min'
}

print(f"前端实际请求URL: {url}")
print(f"前端实际请求参数: {params}")

# 给后端一点时间启动
time.sleep(2)

print("\n=== 发送请求到Flask API ===")
response = requests.get(url, params=params, timeout=30)
print(f"响应状态码: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    
    print(f"\n=== 前端实际接收到的响应 ===")
    print(f"dataSource: {data.get('dataSource', 'N/A')}")
    print(f"note: {data.get('note', 'N/A')}")
    print(f"count: {data.get('count', 0)}")
    
    if 'data' in data:
        values = data['data']
        print(f"前端接收到的数据点数: {len(values)}")
        
        # 分析分钟分布
        minute_counts = {}
        for item in values:
            time_str = item.get('time', '')
            if ':' in time_str:
                time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
                minute = time_part.split(':')[1]
                minute_counts[minute] = minute_counts.get(minute, 0) + 1
        
        print(f"前端接收到的分钟分布: {minute_counts}")
        print(f"前端接收到的有:00数据: {'00' in minute_counts}")
        print(f"前端接收到的有:30数据: {'30' in minute_counts}")
        
        # 打印前10个点
        print(f"\n前端接收到的前10个datetime:")
        for i, item in enumerate(values[:10]):
            print(f"  {i+1}. {item.get('time')}")
        
        # 打印后10个点
        if len(values) > 10:
            print(f"\n前端接收到的后10个datetime:")
            start_idx = max(0, len(values) - 10)
            for i, item in enumerate(values[start_idx:]):
                print(f"  {start_idx + i + 1}. {item.get('time')}")
        
        # 检查是否修复版
        note = data.get('note', '')
        if "修复版" in note:
            print("\n✅ 前端接收到的是修复版数据")
        else:
            print("\n❌ 前端接收到的不是修复版数据")
    else:
        print(f"响应数据格式错误")
else:
    print(f"请求失败: {response.text}")

print("\n=== 重要检查 ===")
print("请查看Flask控制台输出，确认：")
print("1. [API Route 详细调试] 打印的函数返回数据点数")
print("2. [API Route 详细调试] 打印的函数返回note")
print("3. [API Route 详细调试] 打印的分钟分布")
print("4. [API Route 详细调试] 打印的前后10个datetime")
print("\n关键问题：")
print("- 如果Route打印300个点，但前端收到35个点 → 问题在Route之后")
print("- 如果Route打印35个点 → 问题在Route或函数调用")