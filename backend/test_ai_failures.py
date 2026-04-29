"""
测试AI分析失败原因
"""

import requests
import json
import time

def test_ai_analysis(symbol):
    """测试单个symbol的AI分析链路"""
    print(f'\n测试股票: {symbol}')
    print('='*60)
    
    url = 'http://127.0.0.1:8889/api/ai/analyze/single'
    payload = {'symbol': symbol}
    
    stages = {
        'request_sent': False,
        'response_received': False,
        'http_status': None,
        'success': None,
        'has_ai_data': None,
        'error_message': None,
        'failure_stage': None
    }
    
    try:
        # 1. 发送请求
        print(f'[1] 发送AI分析请求: {symbol}')
        stages['request_sent'] = True
        
        start_time = time.time()
        response = requests.post(url, json=payload, timeout=60)  # 长超时
        elapsed = time.time() - start_time
        
        stages['response_received'] = True
        stages['http_status'] = response.status_code
        
        print(f'[2] 响应状态码: {response.status_code}')
        print(f'[2] 响应时间: {elapsed:.2f}秒')
        
        if response.status_code == 200:
            data = response.json()
            stages['success'] = data.get('success')
            
            print(f'[3] 响应数据:')
            print(f'    success: {data.get("success")}')
            print(f'    hasAiData: {data.get("hasAiData")}')
            print(f'    trendLabel: {data.get("trendLabel")}')
            print(f'    trendScore: {data.get("trendScore")}')
            print(f'    aiReasoning: {data.get("aiReasoning", "N/A")[:50]}...')
            
            # 检查是否有AI数据
            if data.get('success'):
                if data.get('trendLabel') is not None:
                    stages['has_ai_data'] = True
                    print(f'[4] 结果: AI分析成功，有数据')
                    return 'success_with_data', stages
                else:
                    stages['has_ai_data'] = False
                    stages['error_message'] = data.get('error', 'trendLabel is null')
                    print(f'[4] 结果: AI分析成功，但无数据 (trendLabel为null)')
                    return 'success_no_data', stages
            else:
                stages['error_message'] = data.get('error', 'Unknown error')
                print(f'[4] 结果: AI分析失败: {data.get("error")}')
                return 'failed', stages
        else:
            stages['error_message'] = f'HTTP {response.status_code}'
            print(f'[3] HTTP错误: {response.status_code}')
            print(f'[3] 响应内容: {response.text[:200]}')
            return 'http_error', stages
            
    except requests.exceptions.Timeout:
        stages['error_message'] = 'Request timeout'
        stages['failure_stage'] = 'ai_request'
        print(f'[3] 请求超时')
        return 'timeout', stages
        
    except requests.exceptions.ConnectionError:
        stages['error_message'] = 'Connection error'
        stages['failure_stage'] = 'ai_request'
        print(f'[3] 连接错误')
        return 'connection_error', stages
        
    except Exception as e:
        stages['error_message'] = str(e)
        stages['failure_stage'] = 'unknown'
        print(f'[3] 异常: {str(e)}')
        return 'exception', stages

def analyze_failure_stage(symbol, result, stages):
    """分析失败阶段"""
    print(f'\n失败分析: {symbol}')
    print('-'*40)
    
    if result == 'success_with_data':
        print('✅ AI分析成功，有数据')
        return None
    
    elif result == 'success_no_data':
        print('⚠️ AI分析成功，但无数据')
        print(f'   错误信息: {stages.get("error_message")}')
        
        # 根据错误信息判断失败阶段
        error_msg = stages.get('error_message', '').lower()
        
        if 'market' in error_msg or 'price' in error_msg:
            return 'market_data'
        elif 'history' in error_msg:
            return 'history_data'
        elif 'news' in error_msg:
            return 'news_data'
        elif 'api' in error_msg or 'key' in error_msg:
            return 'ai_request'
        else:
            return 'ai_response'
    
    elif result == 'failed':
        print('❌ AI分析失败')
        print(f'   错误信息: {stages.get("error_message")}')
        
        error_msg = stages.get('error_message', '').lower()
        
        if 'market' in error_msg:
            return 'market_data'
        elif 'history' in error_msg:
            return 'history_data'
        elif 'news' in error_msg:
            return 'news_data'
        elif 'api' in error_msg or 'key' in error_msg:
            return 'ai_request'
        elif 'timeout' in error_msg:
            return 'ai_request'
        elif '429' in error_msg or 'rate limit' in error_msg:
            return 'rate_limit'
        else:
            return 'unknown'
    
    elif result == 'http_error':
        print(f'❌ HTTP错误: {stages.get("http_status")}')
        return 'http_error'
    
    elif result == 'timeout':
        print('❌ 请求超时')
        return 'ai_request'
    
    elif result == 'connection_error':
        print('❌ 连接错误')
        return 'ai_request'
    
    else:
        print(f'❌ 未知错误: {result}')
        return 'unknown'

def main():
    """主测试函数"""
    print('测试AI分析失败原因')
    print('='*60)
    
    # 测试一些常见的股票
    test_symbols = [
        'AAPL',    # 应该成功
        'MSFT',    # 应该成功  
        'GOOGL',   # 应该成功
        'INVALID', # 应该失败
        'TEST123', # 应该失败
        'TSLA',    # 测试另一个
        'AMZN',    # 测试另一个
        'NVDA',    # 测试另一个
        'META',    # 测试另一个
        'JPM'      # 测试另一个
    ]
    
    results = {}
    
    for symbol in test_symbols:
        result, stages = test_ai_analysis(symbol)
        failure_stage = analyze_failure_stage(symbol, result, stages)
        
        results[symbol] = {
            'result': result,
            'failure_stage': failure_stage,
            'stages': stages
        }
        
        # 避免请求太快
        time.sleep(1)
    
    # 总结结果
    print(f'\n\n测试结果总结')
    print('='*60)
    
    success_count = sum(1 for r in results.values() if r['result'] == 'success_with_data')
    no_data_count = sum(1 for r in results.values() if r['result'] == 'success_no_data')
    failed_count = sum(1 for r in results.values() if r['result'] not in ['success_with_data', 'success_no_data'])
    
    print(f'总测试: {len(results)} 个symbol')
    print(f'成功有数据: {success_count}')
    print(f'成功无数据: {no_data_count}')
    print(f'失败: {failed_count}')
    
    print(f'\n失败详情:')
    for symbol, data in results.items():
        if data['result'] != 'success_with_data':
            print(f'  {symbol}: {data["result"]} -> 失败阶段: {data["failure_stage"]}')
    
    # 分析失败阶段分布
    print(f'\n失败阶段分布:')
    failure_stages = {}
    for data in results.values():
        if data['failure_stage']:
            failure_stages[data['failure_stage']] = failure_stages.get(data['failure_stage'], 0) + 1
    
    for stage, count in failure_stages.items():
        print(f'  {stage}: {count} 次')

if __name__ == '__main__':
    main()