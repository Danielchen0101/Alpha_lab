#!/usr/bin/env python3
"""
直接测试真实AI分析端点
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = 'http://127.0.0.1:8889'

def test_direct():
    """直接测试"""
    print("直接测试真实AI分析端点")
    print("="*60)
    
    # 测试AAPL
    symbol = 'AAPL'
    print(f"测试 {symbol}...")
    
    try:
        payload = {'symbol': symbol}
        print(f"发送请求到: {BASE_URL}/ai/analyze/single")
        print(f"请求数据: {json.dumps(payload)}")
        
        start_time = time.time()
        
        response = requests.post(
            f'{BASE_URL}/ai/analyze/single',
            json=payload,
            timeout=30
        )
        
        duration = time.time() - start_time
        print(f"响应时间: {duration:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"响应数据:")
            print(json.dumps(result, indent=2, ensure_ascii=False)[:1000])
            
            # 检查关键字段
            print(f"\n关键字段检查:")
            print(f"  success: {result.get('success')}")
            print(f"  trendLabel: {result.get('trendLabel')}")
            print(f"  overallScore: {result.get('overallScore')}")
            print(f"  aiReasoning: {'有' if result.get('aiReasoning') else '无'}")
            
            if result.get('error'):
                print(f"  error: {result.get('error')}")
                print(f"  error_stage: {result.get('error_stage')}")
            
            return result
        else:
            print(f"响应内容: {response.text[:500]}")
            return None
            
    except requests.exceptions.Timeout:
        print("请求超时 (30秒)")
        return None
    except Exception as e:
        print(f"异常: {str(e)}")
        return None

def test_multiple_symbols():
    """测试多个symbols"""
    print("\n" + "="*60)
    print("测试多个真实symbols")
    print("="*60)
    
    symbols = ['AAPL', 'MSFT', 'TSLA', 'NVDA', 'META']
    results = {}
    
    for symbol in symbols:
        print(f"\n测试 {symbol}...")
        
        try:
            payload = {'symbol': symbol}
            start_time = time.time()
            
            response = requests.post(
                f'{BASE_URL}/ai/analyze/single',
                json=payload,
                timeout=30
            )
            
            duration = time.time() - start_time
            
            if response.status_code == 200:
                result = response.json()
                results[symbol] = {
                    'success': result.get('success', False),
                    'trendLabel': result.get('trendLabel'),
                    'duration': duration,
                    'error': result.get('error'),
                    'error_stage': result.get('error_stage')
                }
                
                if result.get('success'):
                    print(f"  成功 - {duration:.1f}s, trendLabel: {result.get('trendLabel')}")
                else:
                    print(f"  失败 - {duration:.1f}s, 错误: {result.get('error', '未知')}")
            else:
                print(f"  HTTP错误: {response.status_code}")
                results[symbol] = {
                    'success': False,
                    'trendLabel': None,
                    'duration': duration,
                    'error': f'HTTP {response.status_code}',
                    'error_stage': 'http_error'
                }
                
        except requests.exceptions.Timeout:
            print(f"  超时")
            results[symbol] = {
                'success': False,
                'trendLabel': None,
                'duration': 30,
                'error': '请求超时 (30秒)',
                'error_stage': 'timeout'
            }
        except Exception as e:
            print(f"  异常: {str(e)[:30]}")
            results[symbol] = {
                'success': False,
                'trendLabel': None,
                'duration': 0,
                'error': str(e),
                'error_stage': 'exception'
            }
        
        # 延迟
        time.sleep(0.5)
    
    # 分析结果
    print(f"\n" + "="*60)
    print("结果总结")
    print("="*60)
    
    total = len(results)
    success_count = sum(1 for r in results.values() if r['success'])
    empty_count = sum(1 for r in results.values() if not r['success'] or not r['trendLabel'])
    
    print(f"总测试: {total}")
    print(f"成功: {success_count}")
    print(f"失败/空: {empty_count}")
    
    empty_symbols = [s for s, r in results.items() if not r['success'] or not r['trendLabel']]
    if empty_symbols:
        print(f"\n空symbols: {empty_symbols}")
    
    return results

def main():
    """主函数"""
    print(f"真实Market Scanner测试 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 测试单个
    result = test_direct()
    
    # 测试多个
    results = test_multiple_symbols()
    
    # 保存结果
    output_file = 'direct_real_test_results.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'test_time': datetime.now().isoformat(),
            'single_test': result,
            'multiple_tests': results
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n结果已保存到: {output_file}")

if __name__ == '__main__':
    main()