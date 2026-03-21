import requests

print("=== 简单测试Flask API ===")

url = "http://localhost:8890/api/market/history/AAPL"
params = {
    'range': '1week',
    'interval': '30min'
}

print(f"请求: {url}?range=1week&interval=30min")

response = requests.get(url, params=params, timeout=10)
print(f"状态码: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print(f"返回数据点数: {data.get('count', 0)}")
    print(f"note: {data.get('note', 'N/A')}")
    
    # 简单检查
    if data.get('count', 0) == 300 and "修复版" in data.get('note', ''):
        print("✅ 修复成功！")
    else:
        print("❌ 仍然有问题")
else:
    print(f"错误: {response.text}")