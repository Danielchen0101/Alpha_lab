import requests
import json

print("直接测试错误...")

# 测试系统状态接口（应该最简单）
url = 'http://127.0.0.1:8890/api/status'
print(f"测试: {url}")

try:
    response = requests.get(url, timeout=3)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        print(f"成功!")
        data = response.json()
        print(f"数据: {data}")
    else:
        print(f"错误: {response.text[:500]}")
        
except Exception as e:
    print(f"请求失败: {e}")
    import traceback
    traceback.print_exc()

print()
print("测试Finnhub API直接...")

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

quote_url = f"{FINNHUB_BASE_URL}/quote"
params = {
    'symbol': 'AAPL',
    'token': FINNHUB_API_KEY
}

try:
    response = requests.get(quote_url, params=params, timeout=5)
    print(f"Finnhub状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Finnhub数据: {data}")
    else:
        print(f"Finnhub错误: {response.text[:200]}")
        
except Exception as e:
    print(f"Finnhub请求失败: {e}")