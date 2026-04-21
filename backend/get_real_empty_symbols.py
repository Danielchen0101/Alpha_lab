#!/usr/bin/env python3
"""
获取真实空symbol列表
直接测试AI分析端点，记录哪些symbol返回空值
"""

import requests
import json
import time
from datetime import datetime

def test_symbol_with_timeout(symbol, timeout=15):
    """测试单个symbol，带超时控制"""
    print(f"测试 {symbol}...", end=" ")
    
    try:
        payload = {'symbol': symbol}
        start_time = time.time()
        
        response = requests.post(
            'http://127.0.0.1:8889/ai/analyze/single',
            json=payload,
            timeout=timeout
        )
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            success = result.get('success', False)
            trend_label = result.get('trendLabel')
            overall_score = result.get('overallScore')
            ai_reasoning = result.get('aiReasoning')
            
            # 判断是否为空
            is_empty = not success or not trend_label
            
            if success:
                print(f"[成功] 耗时: {duration:.1f}s, trendLabel: {trend_label}, overallScore: {overall_score}")
            else:
                print(f"[失败] 耗时: {duration:.1f}s, 错误: {result.get('error', '未知错误')}")
            
            return {
                'symbol': symbol,
                'success': success,
                'trendLabel': trend_label,
                'overallScore': overall_score,
                'aiReasoning': ai_reasoning,
                'duration': duration,
                'is_empty': is_empty,
                'error': result.get('error'),
                'error_stage': result.get('error_stage')
            }
        else:
            print(f"[HTTP错误] 状态码: {response.status_code}")
            return {
                'symbol': symbol,
                'success': False,
                'trendLabel': None,
                'duration': duration,
                'is_empty': True,
                'error': f'HTTP {response.status_code}',
                'error_stage': 'http_error'
            }
            
    except requests.exceptions.Timeout:
        print(f"[超时] 超过{timeout}秒")
        return {
            'symbol': symbol,
            'success': False,
            'trendLabel': None,
            'duration': timeout,
            'is_empty': True,
            'error': f'请求超时 ({timeout}秒)',
            'error_stage': 'timeout'
        }
    except Exception as e:
        print(f"[异常] {str(e)[:50]}")
        return {
            'symbol': symbol,
            'success': False,
            'trendLabel': None,
            'duration': 0,
            'is_empty': True,
            'error': str(e),
            'error_stage': 'exception'
        }

def main():
    """主函数"""
    print("="*60)
    print("获取真实空symbol列表")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)
    
    # 测试一组常见的symbols
    test_symbols = [
        'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA',  # 科技股
        'AMZN', 'META', 'JPM', 'JNJ', 'V',        # 其他大盘股
        'INVALID', 'TEST123', 'XYZ'               # 无效symbols用于测试错误处理
    ]
    
    results = []
    empty_symbols = []
    
    for i, symbol in enumerate(test_symbols, 1):
        print(f"\n[{i}/{len(test_symbols)}] ", end="")
        result = test_symbol_with_timeout(symbol, timeout=20)
        results.append(result)
        
        if result['is_empty']:
            empty_symbols.append(symbol)
        
        # 批次间延迟，模拟前端300ms延迟
        if i < len(test_symbols):
            time.sleep(0.3)
    
    # 分析结果
    print(f"\n" + "="*60)
    print("结果分析")
    print("="*60)
    
    total = len(results)
    success_count = sum(1 for r in results if r['success'])
    empty_count = len(empty_symbols)
    
    print(f"\n总测试symbols: {total}")
    print(f"成功: {success_count}")
    print(f"失败/空: {empty_count}")
    
    if empty_symbols:
        print(f"\n空symbol列表 ({len(empty_symbols)}个):")
        for symbol in empty_symbols:
            result = next(r for r in results if r['symbol'] == symbol)
            print(f"  - {symbol}:")
            print(f"     成功: {result['success']}")
            print(f"     trendLabel: {result['trendLabel']}")
            print(f"     耗时: {result['duration']:.1f}s")
            if result['error']:
                print(f"     错误: {result['error']}")
            if result['error_stage']:
                print(f"     失败阶段: {result['error_stage']}")
    
    # 按失败阶段分组
    print(f"\n失败阶段分析:")
    failure_stages = {}
    for result in results:
        if result['is_empty']:
            stage = result.get('error_stage', 'unknown')
            failure_stages[stage] = failure_stages.get(stage, 0) + 1
    
    for stage, count in failure_stages.items():
        print(f"  - {stage}: {count}个symbol")
    
    # 保存详细结果
    output_file = 'real_empty_symbols.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'test_time': datetime.now().isoformat(),
            'total_symbols': total,
            'success_count': success_count,
            'empty_count': empty_count,
            'empty_symbols': empty_symbols,
            'failure_stages': failure_stages,
            'detailed_results': results
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n详细结果已保存到: {output_file}")
    print(f"测试完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return results, empty_symbols

if __name__ == '__main__':
    main()