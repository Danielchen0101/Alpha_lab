import requests
import json

print("=== 测试Flask API Route直接输出 ===")

# 测试1 Week 30min数据
url = "http://localhost:8890/api/market/history/AAPL"
params = {
    'range': '1week',
    'interval': '30min'
}

print(f"前端实际请求完整URL: {url}?range=1week&interval=30min")
print(f"前端实际请求参数: {params}")

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
        
        # 关键检查
        note = data.get('note', '')
        count = data.get('count', 0)
        
        print(f"\n=== 关键检查 ===")
        print(f"1. note是否包含'修复版': {'修复版' in note}")
        print(f"2. count是否为300: {count == 300}")
        print(f"3. 是否有:00数据: {'00' in minute_counts}")
        print(f"4. 是否有:30数据: {'30' in minute_counts}")
        
        if count == 300 and '修复版' in note and '00' in minute_counts and '30' in minute_counts:
            print("\n✅ 修复成功！前端接收到修复版数据")
        else:
            print("\n❌ 仍然有问题！前端没有接收到修复版数据")
    else:
        print(f"响应数据格式错误")
else:
    print(f"请求失败: {response.text}")

print("\n=== 重要提示 ===")
print("请查看Flask控制台输出，确认：")
print("1. [API ROUTE] 打印的函数返回note")
print("2. [API ROUTE] 打印的函数返回数据点数")
print("3. [API ROUTE] 打印的分钟分布")
print("4. [API ROUTE] 打印的前后10个datetime")