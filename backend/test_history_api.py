import requests
import json

print('=== 测试历史数据接口 ===')
print('测试URL: http://127.0.0.1:8889/api/market/history/AAPL')

try:
    # 测试1: 不带参数
    print('\n1. 测试不带参数:')
    response = requests.get('http://127.0.0.1:8889/api/market/history/AAPL', timeout=5)
    print(f'状态码: {response.status_code}')
    if response.status_code != 404:
        print(f'响应: {response.text[:200]}')
    else:
        print('返回404 - 路由不存在')
    
    # 测试2: 带参数（模拟前端请求）
    print('\n2. 测试带参数 (interval=1day, range=1month):')
    params = {'interval': '1day', 'range': '1month'}
    response2 = requests.get('http://127.0.0.1:8889/api/market/history/AAPL', params=params, timeout=5)
    print(f'状态码: {response2.status_code}')
    print(f'响应: {response2.text[:200]}')
    
    # 测试3: 检查其他可能的路由
    print('\n3. 检查其他可能的历史数据路由:')
    possible_routes = [
        '/api/market/AAPL/history',
        '/api/history/AAPL',
        '/api/stock/AAPL/history',
        '/api/stock/history/AAPL'
    ]
    
    for route in possible_routes:
        try:
            r = requests.get(f'http://127.0.0.1:8889{route}', timeout=3)
            print(f'  {route}: {r.status_code}')
        except:
            print(f'  {route}: 请求失败')
            
except Exception as e:
    print(f'请求失败: {e}')