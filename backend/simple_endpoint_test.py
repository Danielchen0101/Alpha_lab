"""
简单端点测试
"""

import requests
import time

print('测试端点响应...')

# 测试1: 系统状态
print('\n1. 测试系统状态:')
try:
    response = requests.get('http://127.0.0.1:8889/system/status', timeout=5)
    print(f'   状态码: {response.status_code}')
    print(f'   响应: {response.text[:100]}')
except Exception as e:
    print(f'   失败: {e}')

# 测试2: 市场数据
print('\n2. 测试市场数据:')
try:
    response = requests.get('http://127.0.0.1:8889/market/stocks', timeout=5)
    print(f'   状态码: {response.status_code}')
    if response.status_code == 200:
        import json
        data = response.json()
        print(f'   股票数量: {len(data.get("stocks", []))}')
except Exception as e:
    print(f'   失败: {e}')

# 测试3: AI分析端点（短超时）
print('\n3. 测试AI分析端点（5秒超时）:')
try:
    url = 'http://127.0.0.1:8889/api/ai/analyze/single'
    payload = {'symbol': 'AAPL'}
    
    print(f'   发送请求...')
    start = time.time()
    response = requests.post(url, json=payload, timeout=5)  # 短超时
    elapsed = time.time() - start
    
    print(f'   响应时间: {elapsed:.2f}秒')
    print(f'   状态码: {response.status_code}')
    
    if response.status_code == 200:
        import json
        data = response.json()
        print(f'   success: {data.get("success")}')
        print(f'   trendLabel: {data.get("trendLabel")}')
    else:
        print(f'   响应: {response.text[:100]}')
        
except requests.exceptions.Timeout:
    print('   ⏱️ 请求超时 (5秒)')
    print('   说明: AI分析可能需要更长时间，或者端点不响应')
except requests.exceptions.ConnectionError:
    print('   🔌 连接错误')
except Exception as e:
    print(f'   ❌ 异常: {e}')

print('\n测试完成')