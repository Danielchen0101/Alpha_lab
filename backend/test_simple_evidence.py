#!/usr/bin/env python3
"""
简化取证脚本：获取AI分析的真实证据
"""

import sys
import os
import json
import time
import requests
from datetime import datetime

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_direct_api_call(symbol, api_key, base_url, model):
    """直接测试DeepSeek API调用"""
    print(f"\n{'='*60}")
    print(f"直接API测试: {symbol}")
    print(f"{'='*60}")
    
    if not api_key:
        print("   [ERROR] API密钥为空")
        return None
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': f'简单回复: 测试{symbol}'}],
        'max_tokens': 10,
        'temperature': 0.1
    }
    
    try:
        print(f"   发送请求到: {base_url}/chat/completions")
        print(f"   使用模型: {model}")
        print(f"   API密钥长度: {len(api_key)}")
        print(f"   API密钥前10位: {api_key[:10]}...")
        
        start_time = time.time()
        response = requests.post(
            f'{base_url}/chat/completions',
            headers=headers,
            json=payload,
            timeout=10
        )
        response_time = time.time() - start_time
        
        print(f"   响应时间: {response_time:.2f}s")
        print(f"   状态码: {response.status_code}")
        
        result = {
            'symbol': symbol,
            'status_code': response.status_code,
            'response_time': response_time,
            'headers': dict(response.headers),
            'success': response.status_code == 200
        }
        
        if response.status_code == 200:
            data = response.json()
            result['response_data'] = data
            print(f"   [SUCCESS] API调用成功")
            print(f"   响应内容: {data.get('choices', [{}])[0].get('message', {}).get('content', '')[:100]}")
        elif response.status_code == 429:
            result['error'] = 'Rate limited'
            print(f"   [WARNING] 速率限制 (429)")
            print(f"   响应头: {dict(response.headers)}")
            if 'Retry-After' in response.headers:
                print(f"   建议重试等待: {response.headers['Retry-After']}秒")
        elif response.status_code == 401:
            result['error'] = 'Authentication failed'
            print(f"   [ERROR] 认证失败 (401)")
        elif response.status_code == 400:
            result['error'] = 'Bad request'
            result['response_text'] = response.text[:500]
            print(f"   [ERROR] 请求错误 (400)")
            print(f"   响应体: {response.text[:200]}")
        else:
            result['error'] = f'HTTP {response.status_code}'
            result['response_text'] = response.text[:500]
            print(f"   [ERROR] 其他错误: {response.status_code}")
            print(f"   响应体: {response.text[:200]}")
            
        return result
            
    except requests.exceptions.Timeout:
        print(f"   [ERROR] 请求超时 (10秒)")
        return {
            'symbol': symbol,
            'status_code': 0,
            'response_time': 10,
            'success': False,
            'error': 'Timeout'
        }
    except requests.exceptions.ConnectionError:
        print(f"   [ERROR] 连接错误")
        return {
            'symbol': symbol,
            'status_code': 0,
            'response_time': 0,
            'success': False,
            'error': 'Connection error'
        }
    except Exception as e:
        print(f"   [ERROR] 异常: {str(e)}")
        return {
            'symbol': symbol,
            'status_code': 0,
            'response_time': 0,
            'success': False,
            'error': str(e)
        }

def main():
    """主函数"""
    print("AI分析取证脚本 - 简化版")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 使用硬编码配置（从代码中提取）
    api_key = 'sk-83365246617844178bf8d1e121b7279f'
    base_url = 'https://api.deepseek.com'
    model = 'deepseek-chat'
    print(f"使用硬编码配置")
    
    print(f"API密钥: {api_key[:10]}... (长度: {len(api_key)})")
    print(f"Base URL: {base_url}")
    print(f"模型: {model}")
    
    # 测试symbols
    success_symbols = ['AAPL', 'GOOGL']
    failed_symbols = ['MSFT', 'META', 'NVDA']
    test_symbols = success_symbols + failed_symbols
    
    all_results = {}
    
    print(f"\n{'#'*60}")
    print("直接API调用测试")
    print(f"{'#'*60}")
    
    for i, symbol in enumerate(test_symbols):
        print(f"\n测试 {i+1}/{len(test_symbols)}: {symbol}")
        result = test_direct_api_call(symbol, api_key, base_url, model)
        all_results[symbol] = result
        
        # 添加延迟避免速率限制
        if i < len(test_symbols) - 1:
            wait_time = 3
            print(f"   等待{wait_time}秒避免速率限制...")
            time.sleep(wait_time)
    
    # 输出总结
    print(f"\n{'#'*60}")
    print("测试总结")
    print(f"{'#'*60}")
    
    success_count = 0
    rate_limit_count = 0
    auth_fail_count = 0
    other_fail_count = 0
    
    for symbol, result in all_results.items():
        if result.get('success'):
            success_count += 1
            status = "[SUCCESS]"
        elif result.get('status_code') == 429:
            rate_limit_count += 1
            status = "[RATE LIMITED]"
        elif result.get('status_code') == 401:
            auth_fail_count += 1
            status = "[AUTH FAILED]"
        else:
            other_fail_count += 1
            status = "[FAILED]"
        
        print(f"  {symbol}: {status} (状态码: {result.get('status_code', 'N/A')}, 时间: {result.get('response_time', 0):.2f}s)")
    
    print(f"\n统计:")
    print(f"  总测试: {len(all_results)}")
    print(f"  成功: {success_count}")
    print(f"  速率限制: {rate_limit_count}")
    print(f"  认证失败: {auth_fail_count}")
    print(f"  其他失败: {other_fail_count}")
    
    # 分析失败模式
    print(f"\n失败分析:")
    
    # 检查是否所有失败都是相同的错误
    failed_results = [r for r in all_results.values() if not r.get('success')]
    if failed_results:
        error_codes = [r.get('status_code') for r in failed_results]
        unique_errors = set(error_codes)
        
        if len(unique_errors) == 1:
            error_code = list(unique_errors)[0]
            if error_code == 429:
                print(f"  [结论] 所有失败都是速率限制 (429)")
                print(f"  [建议] 增加symbol之间的延迟，或实现重试逻辑")
            elif error_code == 401:
                print(f"  [结论] 所有失败都是认证失败 (401)")
                print(f"  [建议] 检查API密钥是否有效")
            else:
                print(f"  [结论] 所有失败都是相同错误: {error_code}")
        else:
            print(f"  [结论] 失败原因不一致: {unique_errors}")
            print(f"  [建议] 需要进一步调查不同错误的原因")
    
    # 检查响应时间模式
    print(f"\n响应时间分析:")
    for symbol, result in all_results.items():
        rt = result.get('response_time', 0)
        if rt > 5:
            print(f"  {symbol}: {rt:.2f}s (较慢)")
        elif rt > 2:
            print(f"  {symbol}: {rt:.2f}s (正常)")
        else:
            print(f"  {symbol}: {rt:.2f}s (快速)")
    
    # 保存结果到文件
    output_file = "ai_api_evidence.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        output_data = {
            'timestamp': datetime.now().isoformat(),
            'api_key_preview': api_key[:10] + '...',
            'api_key_length': len(api_key),
            'base_url': base_url,
            'model': model,
            'results': all_results,
            'summary': {
                'total_tested': len(all_results),
                'success_count': success_count,
                'rate_limit_count': rate_limit_count,
                'auth_fail_count': auth_fail_count,
                'other_fail_count': other_fail_count
            }
        }
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n详细结果已保存到: {output_file}")
    
    return all_results

if __name__ == "__main__":
    main()