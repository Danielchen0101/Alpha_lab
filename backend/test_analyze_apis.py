import requests
import json
import time

print("测试Analyze页面相关接口...")
time.sleep(1)

# 测试1: 历史数据接口
print("\n=== 测试历史数据接口 ===")
print("请求URL: GET /api/market/history/AAPL?interval=D&range=1month")
try:
    response = requests.get('http://127.0.0.1:8889/api/market/history/AAPL', 
                          params={'interval': 'D', 'range': '1month'}, 
                          timeout=5)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"成功! 数据条数: {data.get('count')}")
        print(f"数据源: {data.get('dataSource')}")
        print(f"间隔: {data.get('interval')}")
        print(f"范围: {data.get('range')}")
        print(f"响应结构: {list(data.keys())}")
    else:
        print(f"错误响应: {response.text[:200]}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试2: 单股详情接口
print("\n=== 测试单股详情接口 ===")
print("请求URL: GET /api/market/stock/NVDA")
try:
    response = requests.get('http://127.0.0.1:8889/api/market/stock/NVDA', timeout=5)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"成功! 股票: {data.get('symbol')}")
        print(f"名称: {data.get('name')}")
        print(f"价格: {data.get('price')}")
        print(f"市值: {data.get('marketCap')}")
        print(f"数据源: {data.get('dataSource')}")
        print(f"所有字段: {list(data.keys())}")
    else:
        print(f"错误响应: {response.text[:200]}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试3: 检查前端实际请求的路径
print("\n=== 检查前端请求路径 ===")
print("从前端代码分析，请求路径应该是:")
print("  /market/history/AAPL?interval=D&range=1month")
print("注意: 前端可能使用相对路径，需要确认代理配置")

# 测试4: 直接测试前端可能使用的路径
print("\n=== 测试可能的前端路径 ===")
test_paths = [
    '/market/history/AAPL?interval=D&range=1month',
    '/api/market/history/AAPL?interval=D&range=1month'
]

for path in test_paths:
    try:
        r = requests.get(f'http://127.0.0.1:8889{path}', timeout=3)
        print(f"  {path}: {r.status_code}")
    except Exception as e:
        print(f"  {path}: 请求失败 - {e}")