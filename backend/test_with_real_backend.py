#!/usr/bin/env python3
"""
使用测试后端获取真实运行结果
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = 'http://127.0.0.1:8890'

def test_symbol(symbol):
    """测试单个symbol"""
    print(f"测试 {symbol:6s}...", end=" ")
    
    try:
        payload = {'symbol': symbol}
        start_time = time.time()
        
        response = requests.post(
            f'{BASE_URL}/ai/analyze/single',
            json=payload,
            timeout=10
        )
        
        duration = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            success = result.get('success', False)
            trend_label = result.get('trendLabel')
            
            if success:
                print(f"[成功] {duration:.1f}s, trendLabel: {trend_label}")
                return {
                    'symbol': symbol,
                    'success': True,
                    'trendLabel': trend_label,
                    'overallScore': result.get('overallScore'),
                    'aiReasoning': result.get('aiReasoning'),
                    'duration': duration,
                    'is_empty': False,
                    'error': None,
                    'error_stage': None
                }
            else:
                print(f"[失败] {duration:.1f}s, 错误: {result.get('error', '未知')}")
                return {
                    'symbol': symbol,
                    'success': False,
                    'trendLabel': None,
                    'duration': duration,
                    'is_empty': True,
                    'error': result.get('error'),
                    'error_stage': result.get('error_stage')
                }
        else:
            print(f"[HTTP错误] {response.status_code}")
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
        print(f"[超时]")
        return {
            'symbol': symbol,
            'success': False,
            'trendLabel': None,
            'duration': 10,
            'is_empty': True,
            'error': '请求超时 (10秒)',
            'error_stage': 'timeout'
        }
    except Exception as e:
        print(f"[异常] {str(e)[:30]}")
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
    print("真实运行测试 - 使用测试后端")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"后端URL: {BASE_URL}")
    print("="*60)
    
    # 先测试后端健康状态
    try:
        health_resp = requests.get(f'{BASE_URL}/health', timeout=5)
        print(f"后端健康状态: {'正常' if health_resp.status_code == 200 else '异常'}")
    except:
        print("后端连接失败")
        return
    
    # 测试symbols
    test_symbols = [
        'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA',  # 正常symbols
        'AMZN', 'META', 'JPM', 'JNJ', 'V',        # 正常symbols
        'INVALID', 'TEST123', 'XYZ',              # 无效symbols
        'SLOW', 'TIMEOUT'                         # 特殊测试symbols
    ]
    
    results = []
    empty_symbols = []
    
    for i, symbol in enumerate(test_symbols, 1):
        print(f"[{i:2d}/{len(test_symbols)}] ", end="")
        result = test_symbol(symbol)
        results.append(result)
        
        if result['is_empty']:
            empty_symbols.append(symbol)
        
        # 批次间延迟
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
    
    # 失败阶段分析
    print(f"\n失败阶段分析:")
    failure_stages = {}
    for result in results:
        if result['is_empty']:
            stage = result.get('error_stage', 'unknown')
            failure_stages[stage] = failure_stages.get(stage, 0) + 1
    
    for stage, count in failure_stages.items():
        print(f"  - {stage}: {count}个symbol")
    
    # 保存结果
    output_file = 'real_test_results.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'test_time': datetime.now().isoformat(),
            'backend_url': BASE_URL,
            'total_symbols': total,
            'success_count': success_count,
            'empty_count': empty_count,
            'empty_symbols': empty_symbols,
            'failure_stages': failure_stages,
            'detailed_results': results
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n详细结果已保存到: {output_file}")
    
    # 输出后端日志
    print(f"\n" + "="*60)
    print("后端日志摘要")
    print("="*60)
    
    try:
        with open('test_backend.log', 'r', encoding='utf-8') as f:
            logs = f.readlines()
            for log in logs[-20:]:  # 最后20行
                print(log.strip())
    except:
        print("无法读取后端日志")
    
    return results, empty_symbols

if __name__ == '__main__':
    main()