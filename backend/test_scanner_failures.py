"""
测试scanner中股票AI数据缺失的原因
"""

import requests
import time
import json

def test_symbol_with_detailed_logging(symbol):
    """测试单个symbol，模拟scanner实际调用"""
    print(f'\n{"="*60}')
    print(f'测试股票: {symbol}')
    print(f'{"="*60}')
    
    url = 'http://127.0.0.1:8889/api/ai/analyze/single'
    payload = {'symbol': symbol}
    
    failure_stages = []
    
    try:
        # 阶段1: 发送请求
        print(f'[1] 发送AI分析请求...')
        start_time = time.time()
        response = requests.post(url, json=payload, timeout=60)
        elapsed = time.time() - start_time
        
        print(f'    HTTP状态码: {response.status_code}')
        print(f'    响应时间: {elapsed:.2f}秒')
        
        if response.status_code != 200:
            failure_stages.append(('http_error', f'HTTP {response.status_code}'))
            print(f'    ❌ HTTP错误')
            return failure_stages
        
        # 阶段2: 解析响应
        print(f'[2] 解析响应数据...')
        data = response.json()
        
        print(f'    success: {data.get("success")}')
        print(f'    hasAiData: {data.get("hasAiData")}')
        print(f'    trendLabel: {data.get("trendLabel")}')
        
        if not data.get('success'):
            error_msg = data.get('error', 'Unknown error')
            print(f'    ❌ API返回失败: {error_msg}')
            
            # 根据错误信息判断失败阶段
            error_lower = error_msg.lower()
            if 'market' in error_lower or 'price' in error_lower:
                failure_stages.append(('market_data', error_msg))
            elif 'history' in error_lower:
                failure_stages.append(('history_data', error_msg))
            elif 'news' in error_lower:
                failure_stages.append(('news_data', error_msg))
            elif 'api' in error_lower or 'key' in error_lower:
                failure_stages.append(('ai_request', error_msg))
            elif 'timeout' in error_lower:
                failure_stages.append(('ai_request', error_msg))
            elif '429' in error_lower or 'rate limit' in error_lower:
                failure_stages.append(('rate_limit', error_msg))
            else:
                failure_stages.append(('unknown', error_msg))
            
            return failure_stages
        
        # 阶段3: 检查AI数据
        print(f'[3] 检查AI数据...')
        
        if data.get('trendLabel') is not None:
            print(f'    ✅ 有AI数据: {data.get("trendLabel")}')
            print(f'    trendScore: {data.get("trendScore")}')
            print(f'    aiReasoning: {data.get("aiReasoning", "N/A")[:50]}...')
            return []  # 成功，无失败阶段
        else:
            print(f'    ⚠️ 成功但无AI数据 (trendLabel为null)')
            
            # 检查是否有错误信息
            if data.get('error'):
                error_msg = data.get('error')
                print(f'    错误信息: {error_msg}')
                
                # 判断失败阶段
                error_lower = error_msg.lower()
                if 'market' in error_lower:
                    failure_stages.append(('market_data', error_msg))
                elif 'history' in error_lower:
                    failure_stages.append(('history_data', error_msg))
                elif 'news' in error_lower:
                    failure_stages.append(('news_data', error_msg))
                else:
                    failure_stages.append(('ai_response', error_msg))
            else:
                failure_stages.append(('ai_response', 'trendLabel is null but no error message'))
            
            return failure_stages
            
    except requests.exceptions.Timeout:
        print(f'    ❌ 请求超时')
        failure_stages.append(('ai_request', 'Request timeout'))
        return failure_stages
        
    except requests.exceptions.ConnectionError:
        print(f'    ❌ 连接错误')
        failure_stages.append(('ai_request', 'Connection error'))
        return failure_stages
        
    except json.JSONDecodeError:
        print(f'    ❌ JSON解析错误')
        failure_stages.append(('ai_response', 'JSON parse error'))
        return failure_stages
        
    except Exception as e:
        print(f'    ❌ 异常: {str(e)}')
        failure_stages.append(('unknown', str(e)))
        return failure_stages

def analyze_failure_patterns(symbols):
    """分析多个symbol的失败模式"""
    print(f'\n{"="*60}')
    print(f'分析AI数据缺失模式')
    print(f'{"="*60}')
    
    results = {}
    
    for symbol in symbols:
        failures = test_symbol_with_detailed_logging(symbol)
        results[symbol] = failures
        
        # 避免请求太快
        time.sleep(2)
    
    # 分析失败模式
    print(f'\n{"="*60}')
    print(f'失败模式分析')
    print(f'{"="*60}')
    
    # 统计失败阶段
    stage_counts = {}
    symbol_stages = {}
    
    for symbol, failures in results.items():
        if failures:
            stages = [stage for stage, _ in failures]
            symbol_stages[symbol] = stages
            
            for stage in stages:
                stage_counts[stage] = stage_counts.get(stage, 0) + 1
    
    print(f'\n失败阶段统计:')
    for stage, count in stage_counts.items():
        print(f'  {stage}: {count} 次')
    
    print(f'\n各symbol失败详情:')
    for symbol, failures in results.items():
        if failures:
            stages = [f'{stage} ({msg[:30]}...)' for stage, msg in failures]
            print(f'  {symbol}: {", ".join(stages)}')
        else:
            print(f'  {symbol}: ✅ 成功')
    
    # 分析可能的原因
    print(f'\n可能的原因分析:')
    
    if 'market_data' in stage_counts:
        print(f'  1. 市场数据获取失败 ({stage_counts["market_data"]}次)')
        print(f'     可能原因: Alpaca API问题、symbol无效、网络问题')
    
    if 'history_data' in stage_counts:
        print(f'  2. 历史数据获取失败 ({stage_counts["history_data"]}次)')
        print(f'     可能原因: 历史数据API限制、数据不完整')
    
    if 'news_data' in stage_counts:
        print(f'  3. 新闻数据获取失败 ({stage_counts["news_data"]}次)')
        print(f'     可能原因: Finnhub API限制、新闻数据缺失')
    
    if 'ai_request' in stage_counts:
        print(f'  4. AI请求失败 ({stage_counts["ai_request"]}次)')
        print(f'     可能原因: DeepSeek API密钥问题、网络超时、并发限制')
    
    if 'rate_limit' in stage_counts:
        print(f'  5. 速率限制 ({stage_counts["rate_limit"]}次)')
        print(f'     可能原因: Alpaca/Finnhub/DeepSeek API速率限制')
    
    if 'ai_response' in stage_counts:
        print(f'  6. AI响应问题 ({stage_counts["ai_response"]}次)')
        print(f'     可能原因: AI返回格式错误、JSON解析失败、trendLabel为null')
    
    return results

def main():
    """主测试函数"""
    
    # 测试一组symbols
    test_symbols = [
        'AAPL',      # 应该成功
        'MSFT',      # 应该成功
        'GOOGL',     # 应该成功
        'TSLA',      # 测试
        'AMZN',      # 测试
        'NVDA',      # 测试
        'META',      # 测试
        'JPM',       # 测试
        'INVALID',   # 应该失败
        'TEST123',   # 应该失败
        'BRK.B',     # 测试特殊字符
        'BTC-USD',   # 测试加密货币
    ]
    
    print(f'开始测试 {len(test_symbols)} 个symbols')
    print(f'注意: 每个请求间隔2秒，避免速率限制')
    
    results = analyze_failure_patterns(test_symbols)
    
    # 保存结果
    with open('scanner_failure_analysis.json', 'w', encoding='utf-8') as f:
        json.dump({
            'test_time': time.strftime('%Y-%m-%d %H:%M:%S'),
            'symbols_tested': test_symbols,
            'results': {symbol: failures for symbol, failures in results.items()}
        }, f, indent=2, ensure_ascii=False)
    
    print(f'\n结果已保存到: scanner_failure_analysis.json')

if __name__ == '__main__':
    main()