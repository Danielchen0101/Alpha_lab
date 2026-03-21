import requests
import time

print("=== 测试后端并查看日志 ===")

# 测试1 Week 30min数据
url = "http://localhost:8890/api/market/history/AAPL"
params = {
    'range': '1week',
    'interval': '30min'
}

print(f"请求URL: {url}")
print(f"请求参数: {params}")

# 给后端一点时间启动
time.sleep(2)

response = requests.get(url, params=params, timeout=30)
print(f"响应状态码: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    
    if 'data' in data:
        values = data['data']
        print(f"\n后端正式返回数据点数: {len(values)}")
        
        # 分析分钟分布
        minute_counts = {}
        for item in values:
            time_str = item.get('time', '')
            if ':' in time_str:
                time_part = time_str.split(' ')[1] if ' ' in time_str else time_str
                minute = time_part.split(':')[1]
                minute_counts[minute] = minute_counts.get(minute, 0) + 1
        
        print(f"分钟分布: {minute_counts}")
        
        # 打印前10个点
        print(f"\n前10个点:")
        for i, item in enumerate(values[:10]):
            print(f"  {i+1}. {item.get('time')}")
        
        # 检查数据源说明
        print(f"\n数据源说明: {data.get('note', 'N/A')}")
        
        # 检查是否修复版
        if "修复版" in data.get('note', ''):
            print("✅ 使用的是修复版函数")
        else:
            print("❌ 可能使用的是旧版函数")
    else:
        print(f"响应数据格式错误")
else:
    print(f"请求失败: {response.text}")

print("\n=== 重要提示 ===")
print("请查看后端控制台输出，确认：")
print("1. 是否打印了'1 Week：使用30分钟数据，请求300个点（修复版）'")
print("2. 是否打印了'原始数据分钟分布'包含:00和:30")
print("3. 是否打印了'处理后分钟分布'包含:00和:30")