#!/usr/bin/env python3
"""
测试Scanner是否使用保存的配置
模拟Scanner发送多个分析请求
"""

import requests
import json
import time

def test_scanner_requests():
    """测试Scanner发送的多个分析请求"""
    print("测试Scanner配置使用情况")
    print("=" * 80)
    
    # 模拟Scanner会分析的symbols
    symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'AMD', 'XOM', 'V', 'META']
    
    print(f"模拟Scanner分析 {len(symbols)} 个symbols")
    print(f"后端端口: 8889")
    print()
    
    all_results = []
    
    for i, symbol in enumerate(symbols):
        print(f"\n{i+1}. 分析 {symbol}:")
        
        # 模拟前端请求
        payload = {'symbol': symbol}
        
        try:
            start_time = time.time()
            response = requests.post(
                'http://127.0.0.1:8889/ai/analyze/single',
                json=payload,
                timeout=10
            )
            elapsed_ms = (time.time() - start_time) * 1000
            
            print(f"   状态码: {response.status_code}")
            print(f"   响应时间: {elapsed_ms:.0f}ms")
            
            if response.status_code == 200:
                data = response.json()
                
                # 检查关键字段
                success = data.get('success', False)
                trend = data.get('trend', 'N/A')
                score = data.get('overallScore', 'N/A')
                provenance = data.get('provenance', {})
                
                print(f"   成功: {success}")
                print(f"   趋势: {trend}")
                print(f"   分数: {score}")
                print(f"   来源: {provenance}")
                
                # 检查是否使用用户配置
                ai_analysis = provenance.get('aiAnalysis', 'unknown')
                api_call = provenance.get('apiCall', 'unknown')
                
                print(f"   AI Provider: {ai_analysis}")
                print(f"   API调用类型: {api_call}")
                
                all_results.append({
                    'symbol': symbol,
                    'success': success,
                    'trend': trend,
                    'score': score,
                    'ai_analysis': ai_analysis,
                    'api_call': api_call,
                    'response_time': elapsed_ms
                })
            else:
                print(f"   错误: {response.text[:200]}")
                all_results.append({
                    'symbol': symbol,
                    'success': False,
                    'error': response.text[:100],
                    'response_time': elapsed_ms
                })
                
        except Exception as e:
            print(f"   异常: {e}")
            all_results.append({
                'symbol': symbol,
                'success': False,
                'error': str(e)
            })
        
        # 模拟Scanner的延迟
        time.sleep(0.1)
    
    print(f"\n" + "=" * 80)
    print("分析结果汇总:")
    
    # 统计结果
    successful = sum(1 for r in all_results if r.get('success') == True)
    failed = len(all_results) - successful
    
    print(f"总请求数: {len(all_results)}")
    print(f"成功: {successful}")
    print(f"失败: {failed}")
    
    # 检查配置使用情况
    print(f"\n配置使用情况:")
    
    # 获取所有使用的AI provider
    providers = set()
    api_calls = set()
    
    for result in all_results:
        if result.get('success'):
            providers.add(result.get('ai_analysis', 'unknown'))
            api_calls.add(result.get('api_call', 'unknown'))
    
    print(f"使用的AI Providers: {list(providers)}")
    print(f"API调用类型: {list(api_calls)}")
    
    # 检查是否所有成功请求都使用相同的配置
    if len(providers) == 1:
        provider = list(providers)[0]
        print(f"✅ 所有成功请求使用相同的AI Provider: {provider}")
        
        # 检查是否使用用户保存的配置
        if provider == 'DeepSeek':
            print(f"✅ 使用用户配置的DeepSeek provider")
        else:
            print(f"⚠️ 使用其他provider: {provider}")
    else:
        print(f"⚠️ 使用了多个不同的AI Providers: {list(providers)}")
    
    # 检查API调用类型
    if 'mock_fallback' in api_calls:
        print(f"⚠️ 部分请求使用模拟数据 (mock_fallback)")
    if 'real' in api_calls:
        print(f"✅ 部分请求使用真实API调用")
    
    # 检查响应时间
    if successful > 0:
        avg_time = sum(r.get('response_time', 0) for r in all_results if r.get('success')) / successful
        print(f"\n性能统计:")
        print(f"平均响应时间: {avg_time:.0f}ms")
        
        if avg_time < 1000:
            print(f"✅ 响应时间正常 (<1秒)")
        else:
            print(f"⚠️ 响应时间较慢 (>1秒)")
    
    print(f"\n" + "=" * 80)
    print("结论:")
    
    # 加载当前配置
    try:
        config_response = requests.get('http://127.0.0.1:8889/ai/provider/config', timeout=5)
        if config_response.status_code == 200:
            config_data = config_response.json()
            config = config_data.get('config', {})
            
            print(f"当前保存的配置:")
            print(f"  Provider: {config.get('provider')}")
            print(f"  Model: {config.get('model')}")
            print(f"  API Key长度: {len(config.get('apiKey', ''))}")
            print(f"  Base URL: {config.get('baseUrl')}")
            
            # 检查Scanner是否使用保存的配置
            if providers and list(providers)[0] == config.get('provider'):
                print(f"\n✅ Scanner使用保存的配置: {config.get('provider')}")
            else:
                print(f"\n⚠️ Scanner可能未使用保存的配置")
                print(f"  保存的: {config.get('provider')}")
                print(f"  实际使用的: {list(providers)[0] if providers else 'unknown'}")
    except Exception as e:
        print(f"获取配置失败: {e}")

if __name__ == "__main__":
    test_scanner_requests()