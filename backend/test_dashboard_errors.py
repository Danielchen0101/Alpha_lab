import requests
import json

print("测试Dashboard接口各种情况...")

base_url = "http://127.0.0.1:8890"

# 测试1: 正常Dashboard请求
print(f"\n=== 测试1: 正常Dashboard请求 ===")
url1 = f"{base_url}/api/market/stocks"
params1 = {'dashboard': 'true'}

try:
    r1 = requests.get(url1, params=params1, timeout=10)
    print(f"状态码: {r1.status_code}")
    if r1.status_code != 200:
        print(f"响应: {r1.text[:500]}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试2: 不带参数的请求
print(f"\n=== 测试2: 不带参数的请求 ===")
url2 = f"{base_url}/api/market/stocks"

try:
    r2 = requests.get(url2, timeout=10)
    print(f"状态码: {r2.status_code}")
    if r2.status_code != 200:
        print(f"响应: {r2.text[:500]}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试3: 带symbols参数的请求
print(f"\n=== 测试3: 带symbols参数的请求 ===")
url3 = f"{base_url}/api/market/stocks"
params3 = {'symbols': 'AAPL,MSFT,GOOGL'}

try:
    r3 = requests.get(url3, params=params3, timeout=10)
    print(f"状态码: {r3.status_code}")
    if r3.status_code != 200:
        print(f"响应: {r3.text[:500]}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试4: 带dashboard和symbols参数的请求
print(f"\n=== 测试4: 带dashboard和symbols参数的请求 ===")
url4 = f"{base_url}/api/market/stocks"
params4 = {'dashboard': 'true', 'symbols': 'AAPL,MSFT,GOOGL'}

try:
    r4 = requests.get(url4, params=params4, timeout=10)
    print(f"状态码: {r4.status_code}")
    if r4.status_code != 200:
        print(f"响应: {r4.text[:500]}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试5: 无效symbols参数
print(f"\n=== 测试5: 无效symbols参数 ===")
url5 = f"{base_url}/api/market/stocks"
params5 = {'symbols': 'INVALID_SYMBOL_123'}

try:
    r5 = requests.get(url5, params=params5, timeout=10)
    print(f"状态码: {r5.status_code}")
    if r5.status_code != 200:
        print(f"响应: {r5.text[:500]}")
    else:
        data = r5.json()
        print(f"返回数据: {data}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试6: 检查后端进程状态
print(f"\n=== 测试6: 检查后端进程状态 ===")
import subprocess
try:
    result = subprocess.run(['netstat', '-ano'], capture_output=True, text=True)
    if ':8890' in result.stdout:
        print("端口8890正在监听")
    else:
        print("端口8890未监听")
except Exception as e:
    print(f"检查进程失败: {e}")