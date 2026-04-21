"""
最终AI测试
"""

import requests
import json
import time

def test_ai():
    print('测试AI分析端点')
    print('='*60)
    
    url = 'http://127.0.0.1:8889/api/ai/analyze/single'
    
    # 测试AAPL
    print('\n1. 测试AAPL:')
    try:
        payload = {'symbol': 'AAPL'}
        start = time.time()
        response = requests.post(url, json=payload, timeout=60)  # 长超时
        elapsed = time.time() - start
        
        print(f'   响应时间: {elapsed:.2f}秒')
        print(f'   状态码: {response.status_code}')
        
        if response.status_code == 200:
            data = response.json()
            print(f'   success: {data.get("success")}')
            print(f'   hasAiData: {data.get("hasAiData")}')
            print(f'   trendLabel: {data.get("trendLabel")}')
            print(f'   trendScore: {data.get("trendScore")}')
            
            if data.get('error'):
                print(f'   error: {data.get("error")}')
            
            # 判断结果
            if data.get('success') and data.get('trendLabel') is not None:
                print('   ✅ 成功: 有AI数据')
                return True, 'success_with_data'
            elif data.get('success') and data.get('trendLabel') is None:
                print('   ⚠️ 成功但无AI数据')
                return False, 'success_no_data'
            else:
                print('   ❌ 失败')
                return False, 'failed'
        else:
            print(f'   响应: {response.text[:200]}')
            return False, 'http_error'
            
    except requests.exceptions.Timeout:
        print('   ⏱️ 请求超时')
        return False, 'timeout'
    except Exception as e:
        print(f'   ❌ 异常: {e}')
        return False, 'exception'
    
    return False, 'unknown'

def test_multiple():
    """测试多个symbols"""
    symbols = ['AAPL', 'MSFT', 'GOOGL', 'INVALID']
    
    results = {}
    
    for symbol in symbols:
        print(f'\n{"="*60}')
        print(f'测试: {symbol}')
        print(f'{"="*60}')
        
        success, result_type = test_ai_for_symbol(symbol)
        results[symbol] = {
            'success': success,
            'result_type': result_type
        }
        
        time.sleep(2)  # 避免请求太快
    
    # 分析结果
    print(f'\n{"="*60}')
    print('测试结果分析')
    print(f'{"="*60}')
    
    success_count = sum(1 for r in results.values() if r['success'])
    total_count = len(results)
    
    print(f'总测试: {total_count}')
    print(f'成功: {success_count}')
    print(f'失败: {total_count - success_count}')
    
    print(f'\n详细结果:')
    for symbol, data in results.items():
        status = '✅' if data['success'] else '❌'
        print(f'  {status} {symbol}: {data["result_type"]}')

def test_ai_for_symbol(symbol):
    """测试单个symbol"""
    url = 'http://127.0.0.1:8889/api/ai/analyze/single'
    
    try:
        payload = {'symbol': symbol}
        start = time.time()
        response = requests.post(url, json=payload, timeout=60)
        elapsed = time.time() - start
        
        print(f'   响应时间: {elapsed:.2f}秒')
        print(f'   状态码: {response.status_code}')
        
        if response.status_code == 200:
            data = response.json()
            print(f'   success: {data.get("success")}')
            print(f'   trendLabel: {data.get("trendLabel")}')
            
            if data.get('error'):
                print(f'   error: {data.get("error")[:100]}')
            
            # 判断结果
            if data.get('success') and data.get('trendLabel') is not None:
                print(f'   ✅ 成功: {data.get("trendLabel")}')
                return True, 'success_with_data'
            elif data.get('success') and data.get('trendLabel') is None:
                print(f'   ⚠️ 成功但无AI数据')
                return False, 'success_no_data'
            else:
                print(f'   ❌ 失败')
                return False, 'failed'
        else:
            print(f'   响应: {response.text[:200]}')
            return False, 'http_error'
            
    except requests.exceptions.Timeout:
        print('   ⏱️ 请求超时')
        return False, 'timeout'
    except Exception as e:
        print(f'   ❌ 异常: {e}')
        return False, 'exception'
    
    return False, 'unknown'

if __name__ == '__main__':
    # 先测试一个
    test_ai()
    
    # 然后测试多个
    # test_multiple()