import requests

print("测试简单接口...")
url = 'http://127.0.0.1:8890/api/market/stocks'

try:
    response = requests.get(url, timeout=5)
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.text[:500]}")
except Exception as e:
    print(f"错误: {e}")