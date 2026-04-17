"""
直接测试AI端点
"""

import requests
import json

def test_ai_endpoint():
    print('测试AI分析端点...')
    url = 'http://127.0.0.1:8889/api/ai/analyze/single'
    
    # 先测试端点是否存在
    print('1. 测试GET请求:')
    try:
        response = requests.get(url, timeout=5)
        print(f'   GET状态码: {response.status_code}')
        print(f'   GET响应: {response.text[:200]}')
    except Exception as e:
        print(f'   GET异常: {e}')
    
    # 测试POST请求
    print('\n2. 测试POST请求 (AAPL):')
    try:
        payload = {'symbol': 'AAPL'}
        response = requests.post(url, json=payload, timeout=30)
        print(f'   POST状态码: {response.status_code}')
        
        if response.status_code == 200:
            data = response.json()
            print(f'   success: {data.get("success")}')
            print(f'   hasAiData: {data.get("hasAiData")}')
            print(f'   trendLabel: {data.get("trendLabel")}')
            
            if data.get('error'):
                print(f'   error: {data.get("error")}')
        else:
            print(f'   响应: {response.text[:200]}')
            
    except requests.exceptions.Timeout:
        print('   请求超时')
    except requests.exceptions.ConnectionError:
        print('   连接错误')
    except Exception as e:
        print(f'   异常: {e}')
    
    # 测试无效symbol
    print('\n3. 测试POST请求 (INVALID):')
    try:
        payload = {'symbol': 'INVALID'}
        response = requests.post(url, json=payload, timeout=30)
        print(f'   POST状态码: {response.status_code}')
        
        if response.status_code == 200:
            data = response.json()
            print(f'   success: {data.get("success")}')
            print(f'   error: {data.get("error", "N/A")}')
        else:
            print(f'   响应: {response.text[:200]}')
            
    except Exception as e:
        print(f'   异常: {e}')

if __name__ == '__main__':
    test_ai_endpoint()