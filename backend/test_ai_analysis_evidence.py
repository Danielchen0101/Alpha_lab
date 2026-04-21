#!/usr/bin/env python3
"""
取证脚本：获取AI分析的真实证据
测试成功样本：AAPL, GOOGL
测试失败样本：MSFT, META, NVDA
"""

import sys
import os
import json
import time
import requests
from datetime import datetime

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入后端函数
try:
    from start_quant_backend_repaired import (
        analyze_trend_with_deepseek,
        ai_provider_config_state,
        fetch_alpaca_stock_data,
        fetch_finnhub_company_news
    )
    print("成功导入后端函数")
except ImportError as e:
    print(f"导入错误: {e}")
    sys.exit(1)

def test_symbol_analysis(symbol):
    """测试单个symbol的AI分析"""
    print(f"\n{'='*60}")
    print(f"测试股票: {symbol}")
    print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    
    # 1. 获取AI配置
    print(f"\n1. AI配置状态:")
    print(f"   Provider: {ai_provider_config_state.get('provider')}")
    print(f"   API Key: {ai_provider_config_state.get('apiKey', '')[:10]}...")
    print(f"   Base URL: {ai_provider_config_state.get('baseURL')}")
    print(f"   Model: {ai_provider_config_state.get('model')}")
    
    # 2. 获取股票数据
    print(f"\n2. 获取股票数据...")
    stock_data_start = time.time()
    stock_data, stock_error = fetch_alpaca_stock_data(symbol)
    stock_data_time = time.time() - stock_data_start
    
    if stock_error:
        print(f"   股票数据获取失败: {stock_error}")
        stock_data = {}
    else:
        print(f"   股票数据获取成功 ({stock_data_time:.2f}s)")
        print(f"   价格: {stock_data.get('price')}")
        print(f"   涨跌幅: {stock_data.get('changePercent')}")
        print(f"   成交量: {stock_data.get('volume')}")
    
    # 3. 获取新闻数据
    print(f"\n3. 获取新闻数据...")
    news_data_start = time.time()
    news_data, news_error = fetch_finnhub_company_news(symbol, days_back=7)
    news_data_time = time.time() - news_data_start
    
    if news_error:
        print(f"   新闻数据获取失败: {news_error}")
        news_data = {}
    else:
        print(f"   新闻数据获取成功 ({news_data_time:.2f}s)")
        print(f"   新闻数量: {len(news_data) if isinstance(news_data, list) else 0}")
    
    # 4. 调用AI分析
    print(f"\n4. 调用AI分析...")
    ai_start_time = time.time()
    
    try:
        # 直接调用分析函数
        profile_data = {}  # 简化测试
        
        print(f"   调用 analyze_trend_with_deepseek...")
        result = analyze_trend_with_deepseek(symbol, stock_data, news_data, profile_data)
        ai_time = time.time() - ai_start_time
        
        print(f"   AI分析完成 ({ai_time:.2f}s)")
        
        # 检查结果
        if result:
            print(f"   趋势标签: {result.get('trendLabel')}")
            print(f"   总体分数: {result.get('overallScore')}")
            print(f"   置信度: {result.get('confidence')}")
            print(f"   分析来源: {result.get('analysisSource', 'unknown')}")
            
            # 检查是否有错误
            if result.get('trendLabel') is None:
                print(f"   ⚠️ 警告: 返回了null数据")
                return {
                    'symbol': symbol,
                    'status': 'FAILED_NULL',
                    'ai_time': ai_time,
                    'result': result,
                    'stock_data': stock_data,
                    'has_stock_data': bool(stock_data and not stock_error),
                    'has_news_data': bool(news_data and not news_error)
                }
            else:
                print(f"   ✅ 成功获取AI分析")
                return {
                    'symbol': symbol,
                    'status': 'SUCCESS',
                    'ai_time': ai_time,
                    'result': result,
                    'stock_data': stock_data,
                    'has_stock_data': bool(stock_data and not stock_error),
                    'has_news_data': bool(news_data and not news_error)
                }
        else:
            print(f"   ❌ AI分析返回None")
            return {
                'symbol': symbol,
                'status': 'FAILED_NONE',
                'ai_time': ai_time,
                'result': None,
                'stock_data': stock_data,
                'has_stock_data': bool(stock_data and not stock_error),
                'has_news_data': bool(news_data and not news_error)
            }
            
    except Exception as e:
        ai_time = time.time() - ai_start_time
        print(f"   ❌ AI分析异常: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'symbol': symbol,
            'status': 'FAILED_EXCEPTION',
            'ai_time': ai_time,
            'error': str(e),
            'stock_data': stock_data,
            'has_stock_data': bool(stock_data and not stock_error),
            'has_news_data': bool(news_data and not news_error)
        }

def test_direct_api_call(symbol):
    """直接测试DeepSeek API调用"""
    print(f"\n{'='*60}")
    print(f"直接API测试: {symbol}")
    print(f"{'='*60}")
    
    api_key = ai_provider_config_state.get('apiKey', '')
    base_url = ai_provider_config_state.get('baseURL', 'https://api.deepseek.com')
    model = ai_provider_config_state.get('model', 'deepseek-chat')
    
    if not api_key:
        print("   ❌ API密钥为空")
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
        
        if response.status_code == 200:
            result = response.json()
            print(f"   [SUCCESS] API调用成功")
            print(f"   响应内容: {result.get('choices', [{}])[0].get('message', {}).get('content', '')}")
            return {
                'status_code': 200,
                'response_time': response_time,
                'success': True
            }
        elif response.status_code == 429:
            print(f"   [WARNING] 速率限制 (429)")
            print(f"   响应头: {dict(response.headers)}")
            return {
                'status_code': 429,
                'response_time': response_time,
                'success': False,
                'error': 'Rate limited'
            }
        elif response.status_code == 401:
            print(f"   [ERROR] 认证失败 (401)")
            return {
                'status_code': 401,
                'response_time': response_time,
                'success': False,
                'error': 'Authentication failed'
            }
        elif response.status_code == 400:
            print(f"   [ERROR] 请求错误 (400)")
            print(f"   响应体: {response.text[:200]}")
            return {
                'status_code': 400,
                'response_time': response_time,
                'success': False,
                'error': 'Bad request'
            }
        else:
            print(f"   [ERROR] 其他错误: {response.status_code}")
            print(f"   响应体: {response.text[:200]}")
            return {
                'status_code': response.status_code,
                'response_time': response_time,
                'success': False,
                'error': f'HTTP {response.status_code}'
            }
            
    except requests.exceptions.Timeout:
        print(f"   [ERROR] 请求超时 (10秒)")
        return {
            'status_code': 0,
            'response_time': 10,
            'success': False,
            'error': 'Timeout'
        }
    except requests.exceptions.ConnectionError:
        print(f"   [ERROR] 连接错误")
        return {
            'status_code': 0,
            'response_time': 0,
            'success': False,
            'error': 'Connection error'
        }
    except Exception as e:
        print(f"   [ERROR] 异常: {str(e)}")
        return {
            'status_code': 0,
            'response_time': 0,
            'success': False,
            'error': str(e)
        }

def main():
    """主函数"""
    print("AI分析取证脚本")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 测试symbols
    success_symbols = ['AAPL', 'GOOGL']
    failed_symbols = ['MSFT', 'META', 'NVDA']
    
    all_results = {}
    api_test_results = {}
    
    # 首先测试直接API调用
    print(f"\n{'#'*60}")
    print("第一阶段：直接API调用测试")
    print(f"{'#'*60}")
    
    test_symbols = success_symbols + failed_symbols
    for symbol in test_symbols:
        print(f"\n测试 {symbol} 的直接API调用...")
        api_result = test_direct_api_call(symbol)
        api_test_results[symbol] = api_result
        
        # 添加延迟避免速率限制
        if symbol != test_symbols[-1]:
            print("   等待2秒...")
            time.sleep(2)
    
    # 然后测试完整分析流程
    print(f"\n{'#'*60}")
    print("第二阶段：完整分析流程测试")
    print(f"{'#'*60}")
    
    for symbol in test_symbols:
        result = test_symbol_analysis(symbol)
        all_results[symbol] = result
        
        # 添加延迟避免速率限制
        if symbol != test_symbols[-1]:
            print("   等待3秒...")
            time.sleep(3)
    
    # 输出总结
    print(f"\n{'#'*60}")
    print("测试总结")
    print(f"{'#'*60}")
    
    print(f"\nAPI调用测试结果:")
    for symbol, result in api_test_results.items():
        status = "✅ 成功" if result and result.get('success') else "❌ 失败"
        error = result.get('error', '') if result else 'No result'
        print(f"  {symbol}: {status} (状态码: {result.get('status_code', 'N/A') if result else 'N/A'}, 错误: {error})")
    
    print(f"\n完整分析测试结果:")
    success_count = 0
    failed_count = 0
    null_count = 0
    
    for symbol, result in all_results.items():
        status = result.get('status', 'UNKNOWN')
        if status == 'SUCCESS':
            success_count += 1
            status_str = "✅ 成功"
        elif status == 'FAILED_NULL':
            failed_count += 1
            null_count += 1
            status_str = "❌ 失败 (null数据)"
        elif status == 'FAILED_NONE':
            failed_count += 1
            status_str = "❌ 失败 (返回None)"
        elif status == 'FAILED_EXCEPTION':
            failed_count += 1
            status_str = f"❌ 失败 (异常: {result.get('error', 'Unknown')})"
        else:
            failed_count += 1
            status_str = f"❌ 失败 ({status})"
        
        ai_time = result.get('ai_time', 0)
        print(f"  {symbol}: {status_str} ({ai_time:.2f}s)")
    
    print(f"\n统计:")
    print(f"  总测试: {len(all_results)}")
    print(f"  成功: {success_count}")
    print(f"  失败: {failed_count} (其中null数据: {null_count})")
    
    # 检查失败模式
    print(f"\n失败分析:")
    failed_symbols_list = []
    for symbol, result in all_results.items():
        if result.get('status') != 'SUCCESS':
            failed_symbols_list.append(symbol)
    
    if failed_symbols_list:
        print(f"  失败symbols: {failed_symbols_list}")
        
        # 检查是否所有失败都是null数据
        all_null = all(all_results[s].get('status') == 'FAILED_NULL' for s in failed_symbols_list)
        if all_null:
            print(f"  ⚠️ 所有失败都是null数据，可能是速率限制或API密钥问题")
        
        # 检查是否有超时
        timeout_symbols = []
        for symbol in failed_symbols_list:
            result = all_results[symbol]
            if result.get('ai_time', 0) > 14:  # 接近15秒超时
                timeout_symbols.append(symbol)
        
        if timeout_symbols:
            print(f"  ⚠️ 以下symbols可能超时: {timeout_symbols}")
    
    # 保存结果到文件
    output_file = "ai_analysis_evidence.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        output_data = {
            'timestamp': datetime.now().isoformat(),
            'api_test_results': api_test_results,
            'analysis_results': all_results,
            'summary': {
                'total_tested': len(all_results),
                'success_count': success_count,
                'failed_count': failed_count,
                'null_data_count': null_count
            }
        }
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"\n详细结果已保存到: {output_file}")
    
    return all_results

if __name__ == "__main__":
    main()