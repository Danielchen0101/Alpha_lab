#!/usr/bin/env python3
"""
直接证据测试：获取成功symbol和TSLA的真实来源
"""

import sys
import os
import json
import time
import requests
from datetime import datetime

def test_symbol_direct(symbol):
    """直接测试symbol的AI分析API"""
    print(f"\n{'='*60}")
    print(f"测试 {symbol} 的AI分析")
    print(f"{'='*60}")
    
    base_url = "http://localhost:8889"
    
    try:
        # 直接调用AI分析API
        start_time = time.time()
        response = requests.post(
            f"{base_url}/ai/analyze/single",
            json={"symbol": symbol},
            timeout=30
        )
        response_time = time.time() - start_time
        
        print(f"响应时间: {response_time:.2f}s")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # 关键证据：分析来源
            analysis_source = data.get('analysisSource', 'unknown')
            success = data.get('success', False)
            
            print(f"成功: {success}")
            print(f"分析来源: {analysis_source}")
            print(f"趋势标签: {data.get('trend')}")
            print(f"总体分数: {data.get('overallScore')}")
            print(f"置信度: {data.get('confidence')}")
            print(f"成交量状态: {data.get('volumeStatus')}")
            print(f"简洁推理: {data.get('conciseReasoning', '')[:100]}...")
            
            # 判断来源
            if success and analysis_source == 'deepseek':
                print(f"[结论] 来自 DeepSeek AI 分析")
                return {'source': 'deepseek', 'success': True, 'data': data}
            elif success and analysis_source == 'local':
                print(f"[结论] 来自本地规则 (fallback)")
                return {'source': 'local', 'success': True, 'data': data}
            elif not success:
                print(f"[结论] AI分析失败")
                print(f"错误信息: {data.get('error')}")
                return {'source': 'failed', 'success': False, 'data': data}
            else:
                print(f"[结论] 未知来源: {analysis_source}")
                return {'source': 'unknown', 'success': success, 'data': data}
        else:
            print(f"API错误: {response.text[:200]}")
            return {'source': 'api_error', 'success': False, 'error': response.text}
            
    except requests.exceptions.Timeout:
        print(f"[错误] 请求超时 (30秒)")
        return {'source': 'timeout', 'success': False, 'error': 'Timeout'}
    except Exception as e:
        print(f"[错误] 异常: {str(e)}")
        return {'source': 'exception', 'success': False, 'error': str(e)}

def check_backend_logs_for_symbol(symbol):
    """检查后端日志中特定symbol的记录"""
    print(f"\n检查 {symbol} 的后端日志...")
    
    log_file = "quant_backend.log"
    if os.path.exists(log_file):
        try:
            with open(log_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # 查找特定symbol的日志
            symbol_logs = []
            for line in lines[-200:]:  # 最近200行
                if symbol.upper() in line.upper():
                    symbol_logs.append(line.strip())
            
            if symbol_logs:
                print(f"找到 {symbol} 相关日志 ({len(symbol_logs)}条):")
                for log in symbol_logs[-5:]:  # 显示最近5条
                    print(f"  {log}")
            else:
                print(f"未找到 {symbol} 相关日志")
                
        except Exception as e:
            print(f"读取日志文件失败: {str(e)}")
    else:
        print(f"日志文件不存在: {log_file}")

def main():
    """主函数"""
    print("直接证据测试脚本")
    print(f"开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 检查后端是否运行
    try:
        response = requests.get("http://localhost:8889/api/status", timeout=5)
        if response.status_code == 200:
            print("[状态] 后端服务正常运行")
        else:
            print(f"[错误] 后端服务返回错误: {response.status_code}")
            return
    except Exception as e:
        print(f"[错误] 无法连接到后端服务: {str(e)}")
        return
    
    # 测试成功样本
    print(f"\n{'#'*60}")
    print("验证1: 成功样本的真实来源")
    print(f"{'#'*60}")
    
    success_symbols = ['AAPL', 'MSFT', 'AMZN']
    success_results = {}
    
    for symbol in success_symbols:
        print(f"\n测试 {symbol}...")
        result = test_symbol_direct(symbol)
        success_results[symbol] = result
        
        # 检查后端日志
        check_backend_logs_for_symbol(symbol)
        
        # 添加延迟
        if symbol != success_symbols[-1]:
            print(f"\n等待2秒...")
            time.sleep(2)
    
    # 测试失败样本 (TSLA)
    print(f"\n{'#'*60}")
    print("验证2: TSLA为什么失败")
    print(f"{'#'*60}")
    
    print(f"\n测试 TSLA...")
    tsla_result = test_symbol_direct('TSLA')
    check_backend_logs_for_symbol('TSLA')
    
    # 分析结果
    print(f"\n{'#'*60}")
    print("证据总结")
    print(f"{'#'*60}")
    
    print(f"\n成功样本来源:")
    deepseek_count = 0
    local_count = 0
    failed_count = 0
    
    for symbol, result in success_results.items():
        source = result.get('source', 'unknown')
        if source == 'deepseek':
            deepseek_count += 1
            print(f"  {symbol}: [DeepSeek AI分析]")
        elif source == 'local':
            local_count += 1
            print(f"  {symbol}: [本地规则]")
        else:
            failed_count += 1
            print(f"  {symbol}: [失败: {source}]")
    
    print(f"\nTSLA分析:")
    tsla_source = tsla_result.get('source', 'unknown')
    if tsla_source == 'deepseek':
        print(f"  TSLA: [DeepSeek AI分析成功]")
    elif tsla_source == 'local':
        print(f"  TSLA: [本地规则成功]")
    else:
        print(f"  TSLA: [失败: {tsla_source}]")
        if 'error' in tsla_result:
            print(f"  错误: {tsla_result['error']}")
    
    # 验证universe大小
    print(f"\n{'#'*60}")
    print("验证3: Universe大小和扫描状态")
    print(f"{'#'*60}")
    
    # 从代码中获取universe大小
    universe = [
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD', 'AVGO', 'INTC',
        'JPM', 'XOM', 'WMT', 'HD', 'JNJ', 'PG', 'KO', 'PEP', 'V', 'MA'
    ]
    
    print(f"当前Universe大小: {len(universe)} 个symbols")
    print(f"Universe列表: {universe}")
    
    # 检查扫描状态
    print(f"\n扫描状态分析:")
    print(f"  1. 页面显示10行 → 可能是分页显示")
    print(f"  2. Universe有20个symbols → 应该处理20个")
    print(f"  3. 需要检查:")
    print(f"     a. 页面summary中的'scanned count'")
    print(f"     b. 第2页是否有数据")
    print(f"     c. 后端日志是否显示处理了所有symbols")
    
    # 最终结论
    print(f"\n{'#'*60}")
    print("最终修正结论")
    print(f"{'#'*60}")
    
    print(f"\n基于直接证据:")
    
    if deepseek_count > 0:
        print(f"  1. ✅ 成功样本来自DeepSeek AI分析 (不是全部401)")
        print(f"  2. ✅ AI链路部分工作正常")
    else:
        print(f"  1. ⚠️ 成功样本来自本地规则 (DeepSeek可能有问题)")
    
    if tsla_source not in ['deepseek', 'local']:
        print(f"  3. ❌ TSLA单独失败: {tsla_source}")
        print(f"     需要具体错误信息来诊断")
    
    print(f"\n  4. 📊 Universe大小: {len(universe)}个symbols")
    print(f"  5. 📄 页面显示10行 → 很可能是分页显示")
    print(f"     需要验证: 检查第2页和summary统计")
    
    print(f"\n修复重点:")
    print(f"  1. 诊断TSLA的具体失败原因")
    print(f"  2. 确保扫描处理所有{len(universe)}个symbols")
    print(f"  3. 改进错误处理和用户反馈")
    
    # 保存证据
    output_file = "direct_evidence.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        evidence = {
            'timestamp': datetime.now().isoformat(),
            'success_symbols': success_results,
            'tsla_result': tsla_result,
            'universe_size': len(universe),
            'universe': universe,
            'conclusions': {
                'deepseek_working': deepseek_count > 0,
                'tsla_failed': tsla_source not in ['deepseek', 'local'],
                'likely_paginated': True,  # 页面有分页控件
                'needs_verification': ['page2_data', 'summary_count']
            }
        }
        json.dump(evidence, f, indent=2, ensure_ascii=False)
    
    print(f"\n详细证据已保存到: {output_file}")

if __name__ == "__main__":
    main()