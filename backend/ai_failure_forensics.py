#!/usr/bin/env python3
"""
AI调用失败法医分析脚本
收集每个symbol的AI调用详细证据：
1. 调用开始时间
2. 响应时间
3. success状态
4. 状态码
5. 错误消息
6. 是否超时
7. 是否fallback
8. 最终trendAnalysis
9. 最终merged row
"""

import requests
import json
import time
from datetime import datetime
import concurrent.futures
from typing import Dict, Any, List

# 测试的symbols列表（包含已知有问题的symbols）
TEST_SYMBOLS = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META',  # 通常成功
    'TSLA', 'NVDA', 'AMD', 'AVGO', 'INTC',    # 经常出现N/A
    'JPM', 'XOM', 'WMT', 'HD', 'JNJ',         # 其他测试
    'PG', 'KO', 'PEP', 'V', 'MA'              # 其他测试
]

BASE_URL = "http://127.0.0.1:8889"

def analyze_single_symbol(symbol: str) -> Dict[str, Any]:
    """分析单个symbol的AI调用"""
    evidence = {
        'symbol': symbol,
        'start_time': datetime.now().isoformat(),
        'success': False,
        'status_code': None,
        'error': None,
        'timeout': False,
        'fallback': False,
        'response_time_ms': None,
        'trend_analysis': None,
        'raw_response': None
    }
    
    try:
        # 准备请求数据
        payload = {
            'symbol': symbol,
            'stockData': {
                'price': 150.0,
                'changePercent': 1.5,
                'volume': 1000000,
                'dayHigh': 155.0,
                'dayLow': 145.0,
                'previousClose': 148.5
            },
            'newsData': {
                'sentiment': 'positive',
                'topNews': [{'headline': f'Test news for {symbol}', 'url': '#'}]
            }
        }
        
        # 发送请求并计时
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/ai/analyze/single",
            json=payload,
            timeout=30  # 30秒超时
        )
        end_time = time.time()
        
        evidence['response_time_ms'] = round((end_time - start_time) * 1000, 2)
        evidence['status_code'] = response.status_code
        
        if response.status_code == 200:
            data = response.json()
            evidence['raw_response'] = data
            evidence['success'] = data.get('success', False)
            
            if evidence['success']:
                evidence['trend_analysis'] = {
                    'trend': data.get('trend'),
                    'overallScore': data.get('overallScore'),
                    'confidence': data.get('confidence'),
                    'volumeStatus': data.get('volumeStatus'),
                    'conciseReasoning': data.get('conciseReasoning'),
                    'aiReasoning': data.get('aiReasoning'),
                    'provenance': data.get('provenance', {})
                }
                
                # 检查是否fallback
                provenance = data.get('provenance', {})
                evidence['fallback'] = provenance.get('aiAnalysis') == 'local_fallback'
            else:
                evidence['error'] = data.get('error', 'Unknown error')
        else:
            evidence['error'] = f"HTTP {response.status_code}: {response.text[:200]}"
            
    except requests.exceptions.Timeout:
        evidence['timeout'] = True
        evidence['error'] = "Request timeout (30s)"
    except requests.exceptions.ConnectionError:
        evidence['error'] = "Connection error - backend may be down"
    except Exception as e:
        evidence['error'] = str(e)
    
    evidence['end_time'] = datetime.now().isoformat()
    return evidence

def run_forensic_analysis():
    """运行法医分析"""
    print("=== AI调用失败法医分析 ===")
    print(f"开始时间: {datetime.now().isoformat()}")
    print(f"测试symbols数量: {len(TEST_SYMBOLS)}")
    print(f"Base URL: {BASE_URL}")
    print("=" * 60)
    
    all_evidence = []
    
    # 使用线程池并发测试（模拟前端批量调用）
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        future_to_symbol = {executor.submit(analyze_single_symbol, sym): sym for sym in TEST_SYMBOLS}
        
        for future in concurrent.futures.as_completed(future_to_symbol):
            symbol = future_to_symbol[future]
            try:
                evidence = future.result()
                all_evidence.append(evidence)
                
                # 实时输出结果
                status = "[SUCCESS]" if evidence['success'] else "[FAILED]"
                fallback = " (FALLBACK)" if evidence['fallback'] else ""
                timeout = " (TIMEOUT)" if evidence['timeout'] else ""
                response_time = f"{evidence['response_time_ms']}ms" if evidence['response_time_ms'] else "N/A"
                
                print(f"{symbol}: {status}{fallback}{timeout}")
                print(f"  Response time: {response_time}")
                print(f"  Status code: {evidence['status_code']}")
                if evidence['error']:
                    print(f"  Error: {evidence['error']}")
                if evidence['trend_analysis']:
                    print(f"  Trend: {evidence['trend_analysis'].get('trend')}")
                    print(f"  Score: {evidence['trend_analysis'].get('overallScore')}")
                    print(f"  Provenance: {evidence['trend_analysis'].get('provenance', {}).get('aiAnalysis')}")
                print("-" * 40)
                
            except Exception as e:
                print(f"[ERROR] {symbol}: Analysis failed with exception: {e}")
    
    # 统计分析
    print("\n" + "=" * 60)
    print("=== 统计分析 ===")
    
    successful = [e for e in all_evidence if e['success']]
    failed = [e for e in all_evidence if not e['success']]
    timeouts = [e for e in all_evidence if e['timeout']]
    fallbacks = [e for e in all_evidence if e['fallback']]
    
    print(f"总调用数: {len(all_evidence)}")
    print(f"成功: {len(successful)} ({len(successful)/len(all_evidence)*100:.1f}%)")
    print(f"失败: {len(failed)} ({len(failed)/len(all_evidence)*100:.1f}%)")
    print(f"超时: {len(timeouts)}")
    print(f"Fallback: {len(fallbacks)}")
    
    # 响应时间分析
    response_times = [e['response_time_ms'] for e in all_evidence if e['response_time_ms']]
    if response_times:
        avg_time = sum(response_times) / len(response_times)
        max_time = max(response_times)
        min_time = min(response_times)
        print(f"\n响应时间分析:")
        print(f"  平均: {avg_time:.2f}ms")
        print(f"  最小: {min_time:.2f}ms")
        print(f"  最大: {max_time:.2f}ms")
        
        # 找出慢响应
        slow_symbols = [(e['symbol'], e['response_time_ms']) for e in all_evidence 
                       if e['response_time_ms'] and e['response_time_ms'] > 5000]
        if slow_symbols:
            print(f"\n[WARNING] 慢响应symbols (>5s):")
            for symbol, rt in slow_symbols:
                print(f"  {symbol}: {rt}ms")
    
    # 失败详情
    if failed:
        print(f"\n[FAILED] 失败详情:")
        for evidence in failed:
            print(f"  {evidence['symbol']}: {evidence['error']}")
    
    # 保存详细证据
    output_file = "ai_failure_evidence.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_evidence, f, indent=2, ensure_ascii=False)
    
    print(f"\n详细证据已保存到: {output_file}")
    
    # 关键发现总结
    print("\n" + "=" * 60)
    print("=== 关键发现 ===")
    
    # 检查是否有pattern
    problematic_symbols = [e['symbol'] for e in failed]
    if problematic_symbols:
        print(f"经常失败的symbols: {', '.join(problematic_symbols)}")
    
    # 检查响应时间模式
    fast_symbols = [e for e in all_evidence if e['response_time_ms'] and e['response_time_ms'] < 1000]
    medium_symbols = [e for e in all_evidence if e['response_time_ms'] and 1000 <= e['response_time_ms'] < 5000]
    slow_symbols = [e for e in all_evidence if e['response_time_ms'] and e['response_time_ms'] >= 5000]
    
    print(f"快速响应(<1s): {len(fast_symbols)} symbols")
    print(f"中等响应(1-5s): {len(medium_symbols)} symbols")
    print(f"慢响应(≥5s): {len(slow_symbols)} symbols")
    
    # 检查fallback模式
    if fallbacks:
        fallback_symbols = [e['symbol'] for e in fallbacks]
        print(f"使用fallback的symbols: {', '.join(fallback_symbols)}")
    
    return all_evidence

if __name__ == "__main__":
    run_forensic_analysis()