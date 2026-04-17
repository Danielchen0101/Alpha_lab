"""
简单的AI分析测试
"""

import requests
import json

def test_single_symbol(symbol):
    print(f'测试 {symbol}:')
    print('-'*40)
    
    url = 'http://127.0.0.1:8889/api/ai/analyze/single'
    payload = {'symbol': symbol}
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f'状态码: {response.status_code}')
        
        if response.status_code == 200:
            data = response.json()
            print(f'success: {data.get("success")}')
            print(f'hasAiData: {data.get("hasAiData")}')
            print(f'trendLabel: {data.get("trendLabel")}')
            print(f'trendScore: {data.get("trendScore")}')
            
            if data.get('error'):
                print(f'error: {data.get("error")}')
            
            # 检查是否有AI数据
            if data.get('success') and data.get('trendLabel') is not None:
                print('结果: ✅ 有AI数据')
                return True
            elif data.get('success') and data.get('trendLabel') is None:
                print('结果: ⚠️ 成功但无AI数据')
                return False
            else:
                print('结果: ❌ 失败')
                return False
        else:
            print(f'HTTP错误: {response.text[:200]}')
            return False
            
    except Exception as e:
        print(f'异常: {str(e)}')
        return False

# 测试
symbols = ['AAPL', 'MSFT', 'GOOGL', 'INVALID', 'TEST123']

for symbol in symbols:
    test_single_symbol(symbol)
    print()