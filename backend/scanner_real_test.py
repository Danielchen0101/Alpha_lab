#!/usr/bin/env python3
"""
实际运行Market Scanner测试 - 简化版
获取真实运行结果，找出空symbol的真正原因
"""

import requests
import json
import time
from datetime import datetime

def test_single_symbol_ai_analysis(symbol):
    """测试单个symbol的AI分析链路"""
    print(f"\n" + "="*80)
    print(f"测试 {symbol} 的AI分析链路")
    print("="*80)
    
    start_time = time.time()
    
    # 1. 测试market_data获取
    print(f"\n1. 测试market_data获取...")
    market_data = None
    try:
        response = requests.get(f'http://127.0.0.1:8889/market/stock/{symbol}', timeout=10)
        if response.status_code == 200:
            market_data = response.json()
            print(f"   [OK] market_data获取成功")
            print(f"     价格: {market_data.get('price')}")
            print(f"     涨跌幅: {market_data.get('changePercent')}")
            print(f"     成交量: {market_data.get('volume')}")
        else:
            print(f"   [FAIL] market_data获取失败: HTTP {response.status_code}")
            print(f"     响应: {response.text[:200]}")
    except Exception as e:
        print(f"   [FAIL] market_data获取异常: {str(e)}")
    
    # 2. 测试news_data获取
    print(f"\n2. 测试news_data获取...")
    news_data = None
    try:
        # 先测试Finnhub新闻API
        response = requests.get(
            f'http://127.0.0.1:8889/api/news/analyze',
            params={'symbol': symbol},
            timeout=10
        )
        if response.status_code == 200:
            news_data = response.json()
            print(f"   [OK] news_data获取成功")
            print(f"     新闻数量: {news_data.get('newsCount', 0)}")
            print(f"     情绪: {news_data.get('sentiment')}")
            print(f"     新闻源: {news_data.get('newsSource')}")
        else:
            print(f"   [FAIL] news_data获取失败: HTTP {response.status_code}")
            print(f"     响应: {response.text[:200]}")
    except Exception as e:
        print(f"   [FAIL] news_data获取异常: {str(e)}")
    
    # 3. 测试完整的AI分析
    print(f"\n3. 测试完整的AI分析...")
    ai_result = None
    try:
        payload = {
            'symbol': symbol,
            'debug': True  # 请求调试信息
        }
        
        # 记录请求开始时间
        request_start = time.time()
        
        response = requests.post(
            'http://127.0.0.1:8889/ai/analyze/single',
            json=payload,
            timeout=60  # 给AI分析足够时间
        )
        
        request_duration = time.time() - request_start
        print(f"   AI分析请求耗时: {request_duration:.2f}秒")
        
        if response.status_code == 200:
            ai_result = response.json()
            print(f"   [OK] AI分析成功")
            print(f"     success: {ai_result.get('success')}")
            print(f"     trendLabel: {ai_result.get('trendLabel')}")
            print(f"     overallScore: {ai_result.get('overallScore')}")
            print(f"     aiReasoning: {'有' if ai_result.get('aiReasoning') else '无'}")
            
            # 检查数据源信息
            if 'provenance' in ai_result:
                provenance = ai_result['provenance']
                print(f"     数据源: marketData={provenance.get('marketData')}, "
                      f"news={provenance.get('news')}, "
                      f"aiAnalysis={provenance.get('aiAnalysis')}")
            
            # 检查是否有调试信息
            if 'debug' in ai_result:
                debug_info = ai_result['debug']
                print(f"     调试信息:")
                print(f"       - 是否有API密钥: {debug_info.get('api_key_check', {}).get('has_api_key')}")
                print(f"       - 市场数据: {'有' if debug_info.get('market_data') else '无'}")
                print(f"       - 新闻数据: {'有' if debug_info.get('news_data') else '无'}")
        else:
            print(f"   [FAIL] AI分析失败: HTTP {response.status_code}")
            print(f"     响应: {response.text[:500]}")
    except requests.exceptions.Timeout:
        print(f"   [FAIL] AI分析超时 (60秒)")
    except Exception as e:
        print(f"   [FAIL] AI分析异常: {str(e)}")
    
    # 4. 分析结果
    print(f"\n4. 结果分析:")
    total_duration = time.time() - start_time
    
    if ai_result and ai_result.get('success'):
        print(f"   [OK] {symbol} AI分析成功完成")
        print(f"     总耗时: {total_duration:.2f}秒")
        
        # 检查关键字段是否为空
        empty_fields = []
        for field in ['trendLabel', 'trendScore', 'overallScore', 'aiReasoning']:
            if not ai_result.get(field):
                empty_fields.append(field)
        
        if empty_fields:
            print(f"   [WARN] 但以下字段为空: {', '.join(empty_fields)}")
        else:
            print(f"   [OK] 所有关键字段都有值")
    else:
        print(f"   [FAIL] {symbol} AI分析失败或返回不成功")
        print(f"     总耗时: {total_duration:.2f}秒")
        
        if ai_result:
            print(f"     错误信息: {ai_result.get('error', '无错误信息')}")
            print(f"     失败阶段: {ai_result.get('error_stage', '未知')}")
    
    return ai_result

def test_batch_scanner():
    """测试批量扫描器"""
    print(f"\n" + "="*80)
    print(f"测试批量扫描器")
    print("="*80)
    
    # 使用常见的测试symbols
    test_symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V']
    
    results = {}
    empty_symbols = []
    
    for i, symbol in enumerate(test_symbols, 1):
        print(f"\n[{i}/{len(test_symbols)}] 测试 {symbol}")
        
        result = test_single_symbol_ai_analysis(symbol)
        results[symbol] = result
        
        # 检查是否为空
        if not result or not result.get('success') or not result.get('trendLabel'):
            empty_symbols.append(symbol)
        
        # 批次间延迟，模拟前端300ms延迟
        if i < len(test_symbols):
            time.sleep(0.3)
            print(f"\n" + "-"*40 + " 批次间300ms延迟 " + "-"*40)
    
    # 输出总结
    print(f"\n" + "="*80)
    print(f"批量扫描测试总结")
    print("="*80)
    
    print(f"\n测试symbols: {len(test_symbols)}个")
    success_count = len([r for r in results.values() if r and r.get('success')])
    print(f"成功symbols: {success_count}个")
    print(f"空symbols: {len(empty_symbols)}个")
    
    if empty_symbols:
        print(f"\n空symbol列表:")
        for symbol in empty_symbols:
            result = results[symbol]
            print(f"  - {symbol}:")
            if result:
                print(f"     success: {result.get('success')}")
                print(f"     trendLabel: {result.get('trendLabel')}")
                print(f"     error: {result.get('error', '无错误信息')}")
                print(f"     error_stage: {result.get('error_stage', '未知')}")
            else:
                print(f"     结果为空")
    
    # 分析失败原因
    print(f"\n失败原因分析:")
    failure_reasons = {}
    for symbol, result in results.items():
        if not result or not result.get('success'):
            error = result.get('error', '未知错误') if result else '请求失败'
            error_stage = result.get('error_stage', '未知阶段') if result else '请求阶段'
            
            key = f"{error_stage}: {error[:50]}"
            failure_reasons[key] = failure_reasons.get(key, 0) + 1
    
    for reason, count in failure_reasons.items():
        print(f"  - {reason}: {count}个symbol")
    
    return results, empty_symbols

def check_backend_status():
    """检查后端服务状态"""
    print(f"检查后端服务状态...")
    
    try:
        # 检查系统状态端点
        response = requests.get('http://127.0.0.1:8889/system/status', timeout=5)
        if response.status_code == 200:
            status_data = response.json()
            print(f"  [OK] 后端服务运行正常")
            print(f"     状态: {status_data.get('status')}")
            print(f"     版本: {status_data.get('version')}")
            return True
        else:
            print(f"  [FAIL] 后端服务响应异常: HTTP {response.status_code}")
            return False
    except Exception as e:
        print(f"  [FAIL] 后端服务连接失败: {str(e)}")
        return False

def main():
    """主函数"""
    print(f"Market Scanner真实运行测试")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # 检查后端服务
    if not check_backend_status():
        print(f"\n错误: 后端服务不可用，无法进行测试")
        return
    
    # 测试批量扫描器
    results, empty_symbols = test_batch_scanner()
    
    # 保存结果到文件
    output_file = 'scanner_test_results.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'test_time': datetime.now().isoformat(),
            'total_symbols': len(results),
            'empty_symbols': empty_symbols,
            'results': results
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n测试结果已保存到: {output_file}")
    print(f"测试完成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == '__main__':
    main()