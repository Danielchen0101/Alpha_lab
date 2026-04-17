#!/usr/bin/env python3
"""
简单Market Scanner测试
直接测试AI分析端点，获取真实结果
"""

import requests
import json
import time

def test_ai_analysis(symbol):
    """测试单个symbol的AI分析"""
    print(f"\n测试 {symbol}...")
    
    try:
        payload = {
            'symbol': symbol,
            'debug': True
        }
        
        start_time = time.time()
        response = requests.post(
            'http://127.0.0.1:8889/ai/analyze/single',
            json=payload,
            timeout=30
        )
        duration = time.time() - start_time
        
        if response.status_code == 200:
            result = response.json()
            print(f"  耗时: {duration:.2f}秒")
            print(f"  success: {result.get('success')}")
            print(f"  trendLabel: {result.get('trendLabel')}")
            print(f"  overallScore: {result.get('overallScore')}")
            print(f"  aiReasoning: {'有' if result.get('aiReasoning') else '无'}")
            
            # 检查是否有错误
            if result.get('error'):
                print(f"  error: {result.get('error')}")
                print(f"  error_stage: {result.get('error_stage', '未知')}")
            
            return result
        else:
            print(f"  HTTP错误: {response.status_code}")
            print(f"  响应: {response.text[:200]}")
            return None
            
    except requests.exceptions.Timeout:
        print(f"  请求超时 (30秒)")
        return None
    except Exception as e:
        print(f"  异常: {str(e)}")
        return None

def main():
    """主函数"""
    print("Market Scanner真实运行测试")
    print("="*60)
    
    # 测试一组symbols
    symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA', 'AMZN', 'META', 'JPM', 'JNJ', 'V']
    
    results = {}
    empty_symbols = []
    
    for i, symbol in enumerate(symbols, 1):
        print(f"\n[{i}/{len(symbols)}] ", end="")
        result = test_ai_analysis(symbol)
        results[symbol] = result
        
        # 检查是否为空
        if not result or not result.get('success') or not result.get('trendLabel'):
            empty_symbols.append(symbol)
        
        # 批次间延迟
        if i < len(symbols):
            time.sleep(0.3)
    
    # 输出总结
    print(f"\n" + "="*60)
    print("测试总结")
    print("="*60)
    
    print(f"\n总symbols: {len(symbols)}")
    success_count = len([r for r in results.values() if r and r.get('success')])
    print(f"成功: {success_count}")
    print(f"失败/空: {len(empty_symbols)}")
    
    if empty_symbols:
        print(f"\n空symbol列表:")
        for symbol in empty_symbols:
            result = results[symbol]
            print(f"  - {symbol}: ", end="")
            if result:
                print(f"success={result.get('success')}, trendLabel={result.get('trendLabel')}")
                if result.get('error'):
                    print(f"    错误: {result.get('error')}")
                    print(f"    阶段: {result.get('error_stage', '未知')}")
            else:
                print("结果为空")
    
    # 保存结果
    with open('scanner_results.json', 'w', encoding='utf-8') as f:
        json.dump({
            'test_time': time.time(),
            'symbols': symbols,
            'empty_symbols': empty_symbols,
            'results': results
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n结果已保存到: scanner_results.json")

if __name__ == '__main__':
    main()