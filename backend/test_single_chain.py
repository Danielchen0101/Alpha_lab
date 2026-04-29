"""
测试单个symbol的AI调用链
"""

import requests
import json
import time

def test_single_symbol(symbol):
    print(f'\n测试股票: {symbol}')
    print('='*50)
    
    url = 'http://127.0.0.1:8890/ai/analyze/single'
    payload = {'symbol': symbol}
    
    try:
        # 1. 发送请求
        print(f'[1] 发送请求到: {url}')
        print(f'[1] 请求数据: {json.dumps(payload)}')
        
        start_time = time.time()
        response = requests.post(url, json=payload, timeout=30)
        elapsed = time.time() - start_time
        
        print(f'[2] 响应状态码: {response.status_code}')
        print(f'[2] 响应时间: {elapsed:.2f}秒')
        
        if response.status_code == 200:
            data = response.json()
            print(f'[3] 响应数据:')
            print(f'    success: {data.get("success")}')
            print(f'    hasAiData: {data.get("hasAiData")}')
            print(f'    trendLabel: {data.get("trendLabel")}')
            print(f'    trendScore: {data.get("trendScore")}')
            print(f'    scannerReason: {data.get("scannerReason")}')
            
            ai_reasoning = data.get("aiReasoning", "N/A")
            if ai_reasoning:
                print(f'    aiReasoning: {ai_reasoning[:50]}...')
            else:
                print(f'    aiReasoning: {ai_reasoning}')
            
            if data.get('success'):
                if data.get('hasAiData'):
                    print(f'[4] 结果: AI分析成功，有数据')
                    return 'success_with_data'
                else:
                    print(f'[4] 结果: AI分析成功，但无数据 (trendLabel为null)')
                    return 'success_no_data'
            else:
                print(f'[4] 结果: AI分析失败: {data.get("error")}')
                return 'failed'
        else:
            print(f'[3] HTTP错误: {response.status_code}')
            print(f'[3] 响应内容: {response.text[:200]}')
            return 'http_error'
            
    except requests.exceptions.ConnectionError:
        print(f'[ERROR] 无法连接到后端服务 (端口8890)')
        return 'connection_error'
    except requests.exceptions.Timeout:
        print(f'[ERROR] 请求超时 (30秒)')
        return 'timeout'
    except Exception as e:
        print(f'[ERROR] 异常: {str(e)}')
        return 'exception'

def main():
    """主函数"""
    # 测试多个symbol
    symbols = ['AAPL', 'MSFT', 'GOOGL', 'INVALID', 'TEST123']
    
    print('开始测试单个symbol的AI调用链...')
    print('='*60)
    
    results = {}
    for symbol in symbols:
        result = test_single_symbol(symbol)
        results[symbol] = result
        time.sleep(1)  # 避免请求过快
    
    print(f'\n测试结果汇总:')
    print('='*60)
    for symbol, result in results.items():
        print(f'{symbol}: {result}')
    
    # 检查后端健康状态
    try:
        health_response = requests.get('http://127.0.0.1:8890/health', timeout=5)
        if health_response.status_code == 200:
            print(f'\n后端服务健康检查: 正常')
        else:
            print(f'\n后端服务健康检查: 异常 (状态码: {health_response.status_code})')
    except:
        print(f'\n后端服务健康检查: 无法连接')
    
    # 分析结果
    print(f'\n诊断分析:')
    print('='*60)
    
    success_with_data = [s for s, r in results.items() if r == 'success_with_data']
    success_no_data = [s for s, r in results.items() if r == 'success_no_data']
    failed = [s for s, r in results.items() if r in ['failed', 'http_error', 'connection_error', 'timeout', 'exception']]
    
    print(f'成功且有数据: {len(success_with_data)}个 ({", ".join(success_with_data)})')
    print(f'成功但无数据: {len(success_no_data)}个 ({", ".join(success_no_data)})')
    print(f'失败: {len(failed)}个 ({", ".join(failed)})')
    
    if success_no_data:
        print(f'\n关键发现:')
        print(f'- 所有symbol都成功调用了AI接口 (HTTP 200)')
        print(f'- 但部分/全部symbol返回的trendLabel为null')
        print(f'- 这表明AI分析函数本身返回了null数据')
        print(f'- 可能原因: API密钥无效、AI调用失败、数据不完整')
    
    if failed:
        print(f'\n失败分析:')
        print(f'- 这些symbol在请求阶段就失败了')
        print(f'- 可能原因: 后端服务问题、网络问题、请求格式错误')

if __name__ == '__main__':
    main()