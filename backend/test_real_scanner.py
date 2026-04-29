#!/usr/bin/env python3
"""
测试真实Market Scanner链路
使用真实后端和真实symbols
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = 'http://127.0.0.1:8889'

def test_real_symbol(symbol, timeout=30):
    """测试真实symbol的AI分析链路"""
    print(f"测试 {symbol:6s}...", end=" ")
    
    try:
        payload = {'symbol': symbol}
        start_time = time.time()
        
        response = requests.post(
            f'{BASE_URL}/ai/analyze/single',
            json=payload,
            timeout=timeout
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
                    'error_stage': None,
                    'raw_response': result
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
                    'error_stage': result.get('error_stage'),
                    'raw_response': result
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
                'error_stage': 'http_error',
                'raw_response': None
            }
            
    except requests.exceptions.Timeout:
        print(f"[超时]")
        return {
            'symbol': symbol,
            'success': False,
            'trendLabel': None,
            'duration': timeout,
            'is_empty': True,
            'error': f'请求超时 ({timeout}秒)',
            'error_stage': 'timeout',
            'raw_response': None
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
            'error_stage': 'exception',
            'raw_response': None
        }

def check_backend_health():
    """检查后端健康状态"""
    print("检查后端健康状态...")
    
    try:
        # 检查系统状态
        response = requests.get(f'{BASE_URL}/system/status', timeout=5)
        if response.status_code == 200:
            status_data = response.json()
            print(f"  后端状态: {status_data.get('status')}")
            print(f"  版本: {status_data.get('version')}")
            return True
        else:
            print(f"  后端响应异常: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"  后端连接失败: {str(e)}")
        return False

def analyze_failure_stage(result):
    """分析失败阶段"""
    if not result or not result.get('is_empty'):
        return "success"
    
    error_stage = result.get('error_stage')
    if error_stage:
        return error_stage
    
    error = result.get('error', '').lower()
    
    # 根据错误信息推断阶段
    if 'market' in error or 'alpaca' in error:
        return 'market_data'
    elif 'news' in error or 'finnhub' in error:
        return 'news_data'
    elif 'ai' in error or 'deepseek' in error:
        return 'ai_request'
    elif 'timeout' in error:
        return 'timeout'
    elif 'symbol' in error:
        return 'symbol_validation'
    else:
        return 'unknown'

def main():
    """主函数"""
    print("="*60)
    print("真实Market Scanner链路测试")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"后端URL: {BASE_URL}")
    print("="*60)
    
    # 检查后端健康
    if not check_backend_health():
        print("后端不可用，无法测试")
        return
    
    # 使用真实的股票symbols
    real_symbols = [
        'AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA',  # 科技股
        'AMZN', 'META', 'JPM', 'JNJ', 'V',        # 其他大盘股
        # 不包含无效symbols
    ]
    
    print(f"\n开始测试 {len(real_symbols)} 个真实symbols...")
    
    results = []
    empty_symbols = []
    
    for i, symbol in enumerate(real_symbols, 1):
        print(f"[{i:2d}/{len(real_symbols)}] ", end="")
        result = test_real_symbol(symbol, timeout=60)  # 60秒超时，给AI分析足够时间
        results.append(result)
        
        # 分析失败阶段
        result['failure_stage'] = analyze_failure_stage(result)
        
        if result['is_empty']:
            empty_symbols.append(symbol)
        
        # 批次间延迟，模拟前端300ms延迟
        if i < len(real_symbols):
            time.sleep(0.3)
    
    # 分析结果
    print(f"\n" + "="*60)
    print("测试结果分析")
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
            print(f"     失败阶段: {result['failure_stage']}")
            if result['error']:
                print(f"     错误: {result['error']}")
    
    # 失败阶段分析
    print(f"\n失败阶段详细分析:")
    failure_stages = {}
    for result in results:
        if result['is_empty']:
            stage = result['failure_stage']
            failure_stages[stage] = failure_stages.get(stage, 0) + 1
    
    for stage, count in failure_stages.items():
        print(f"  - {stage}: {count}个symbol")
    
    # 保存详细结果
    output_file = 'real_scanner_test_results.json'
    
    # 清理raw_response，避免JSON序列化问题
    for result in results:
        if 'raw_response' in result:
            # 只保留关键信息
            raw = result['raw_response']
            if raw and isinstance(raw, dict):
                result['raw_response_summary'] = {
                    'keys': list(raw.keys()),
                    'success': raw.get('success'),
                    'error': raw.get('error'),
                    'error_stage': raw.get('error_stage')
                }
            result.pop('raw_response', None)
    
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
    print(f"测试完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 输出后端日志摘要
    print(f"\n" + "="*60)
    print("后端日志摘要 (最后20行)")
    print("="*60)
    
    try:
        with open('real_backend.log', 'r', encoding='utf-8') as f:
            logs = f.readlines()
            for log in logs[-20:]:  # 最后20行
                print(log.strip())
    except:
        print("无法读取后端日志")
    
    return results, empty_symbols

if __name__ == '__main__':
    main()