#!/usr/bin/env python3
"""
捕获真实优化请求的证据
"""

import json
import requests
import time
import sys

def capture_real_request():
    """捕获真实请求证据"""
    
    # 等待后端启动
    print("等待后端服务启动...")
    time.sleep(3)
    
    # 测试配置 - 与页面截图一致
    payload = {
        "symbol": "AAPL",
        "strategy": "moving_average",
        "startDate": "2025-04-01",  # 1年前
        "endDate": "2026-04-10",    # 今天
        "initialCapital": 100000,
        "shortMaRange": {"start": 5, "end": 25, "step": 5},  # 5,10,15,20,25
        "longMaRange": {"start": 50, "end": 200, "step": 25}  # 50,75,100,125,150,175,200
    }
    
    base_url = "http://127.0.0.1:8889"
    
    print(f"\n{'='*80}")
    print(f"1. 真实请求证据")
    print(f"{'='*80}")
    
    print(f"\n请求URL: POST {base_url}/api/backtest/optimize")
    print(f"请求Payload:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    
    try:
        # 发送优化请求
        start_time = time.time()
        response = requests.post(
            f"{base_url}/api/backtest/optimize",
            json=payload,
            timeout=60
        )
        elapsed = time.time() - start_time
        
        print(f"\n响应时间: {elapsed:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"\n响应数据 (简化):")
            print(f"成功: {data.get('success', False)}")
            print(f"优化ID: {data.get('optimizationId', 'None')}")
            print(f"错误信息: {data.get('error', 'None')}")
            
            if data.get('success', False):
                # 检查参数
                parameters = data.get('parameters', {})
                print(f"\n参数信息:")
                print(f"  数据源: {parameters.get('dataSource', 'Not specified')}")
                print(f"  历史数据点: {parameters.get('historicalDataPoints', 0)}")
                print(f"  符号: {parameters.get('symbol', 'N/A')}")
                print(f"  策略: {parameters.get('strategy', 'N/A')}")
                print(f"  开始日期: {parameters.get('startDate', 'N/A')}")
                print(f"  结束日期: {parameters.get('endDate', 'N/A')}")
                
                # 检查结果
                results = data.get('results', [])
                print(f"\n结果数量: {len(results)}")
                
                if results:
                    # 检查第一个结果
                    print(f"\n第一个结果 (Rank 1):")
                    first_result = results[0]
                    print(json.dumps(first_result, indent=2, ensure_ascii=False))
                    
                    # 检查数据源一致性
                    print(f"\n数据源验证:")
                    all_sources = set(r.get('dataSource', 'Unknown') for r in results)
                    if len(all_sources) == 1:
                        source = list(all_sources)[0]
                        print(f"  ✅ 所有结果使用相同数据源: {source}")
                        if 'Alpaca' in source:
                            print(f"  ✅ 数据源是Alpaca")
                            if 'feed=' in source:
                                print(f"  ✅ 包含feed信息: {source}")
                        else:
                            print(f"  ❌ 数据源不是Alpaca: {source}")
                    else:
                        print(f"  ❌ 数据源不一致: {all_sources}")
                        
                else:
                    print(f"\n❌ 没有优化结果")
                    
            else:
                error_msg = data.get('error', 'Unknown error')
                print(f"\n❌ 优化失败: {error_msg}")
                
        else:
            print(f"\n❌ 请求失败: {response.status_code}")
            print(f"响应内容: {response.text[:1000]}")
            
    except requests.exceptions.Timeout:
        print(f"\n❌ 请求超时 (60秒)")
    except requests.exceptions.ConnectionError:
        print(f"\n❌ 连接错误 - 确保后端服务正在运行 (python start_quant_backend.py)")
    except Exception as e:
        print(f"\n❌ 异常: {str(e)}")
    
    return payload

def check_backend_logs():
    """检查后端日志中的证据"""
    print(f"\n{'='*80}")
    print(f"2. 后端日志证据 (需要查看控制台输出)")
    print(f"{'='*80}")
    
    print(f"\n预期后端日志应包含:")
    print(f"  [Optimization] 收到参数优化请求: {{...}}")
    print(f"  [Optimization] 获取Alpaca历史数据: AAPL, 2025-04-01 到 2026-04-10")
    print(f"  [Optimization Alpaca] URL = https://data.alpaca.markets/v2/stocks/AAPL/bars")
    print(f"  [Optimization Alpaca] params = {{'timeframe': '1Day', 'feed': 'sip', ...}}")
    print(f"  [Optimization Alpaca] status = 200 或 403 -> iex")
    print(f"  [Optimization] historical_data length = 252 (大约)")
    print(f"  [Optimization] first bar = {{'timestamp': '2025-04-01', 'open': ..., ...}}")
    print(f"  [Optimization] last bar = {{'timestamp': '2026-04-10', 'open': ..., ...}}")
    print(f"  [Optimization] 生成 X x Y = Z 个参数组合")
    print(f"  [Optimization] testing combo short=X, long=Y")
    print(f"  [Optimization] combo success short=X, long=Y, return=...%")

def verify_no_mock_fallback():
    """验证没有mock/fallback"""
    print(f"\n{'='*80}")
    print(f"3. 验证没有mock/fallback")
    print(f"{'='*80}")
    
    import os
    
    backend_file = "start_quant_backend.py"
    
    # 检查的关键词
    forbidden_patterns = [
        'generate_simulation_result',
        'generate_alpaca_based_history',
        'generate_mock_history',
        'mock history',
        'simulated history',
        'fallback to Finnhub',
        'fallback to Twelve Data',
        'Twelve Data API',
        'Finnhub API'
    ]
    
    print(f"\n检查文件: {backend_file}")
    
    try:
        with open(backend_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        found_patterns = []
        for pattern in forbidden_patterns:
            if pattern in content:
                found_patterns.append(pattern)
                
        if found_patterns:
            print(f"\n⚠️  发现可能的mock/fallback模式:")
            for pattern in found_patterns:
                print(f"  - {pattern}")
            print(f"\n需要检查这些模式是否在optimization链路中被调用")
        else:
            print(f"\n✅ 未发现明显的mock/fallback模式")
            
    except Exception as e:
        print(f"\n❌ 检查文件失败: {str(e)}")

def verify_heatmap_consistency(results_data):
    """验证heatmap和表格的一致性"""
    print(f"\n{'='*80}")
    print(f"4. 验证Heatmap和表格一致性")
    print(f"{'='*80}")
    
    if not results_data or 'results' not in results_data or not results_data['results']:
        print(f"❌ 没有结果数据，无法验证")
        return
    
    results = results_data['results']
    
    # A. 表格第一名
    print(f"\nA. 表格第一名 (Rank 1):")
    rank1 = results[0]
    print(f"  Rank: {rank1.get('rank', 'N/A')}")
    print(f"  Short MA: {rank1.get('short_ma', rank1.get('parameters', {}).get('shortMaPeriod', 'N/A'))}")
    print(f"  Long MA: {rank1.get('long_ma', rank1.get('parameters', {}).get('longMaPeriod', 'N/A'))}")
    print(f"  Sharpe Ratio: {rank1.get('sharpeRatio', 'N/A')}")
    print(f"  Total Return: {rank1.get('totalReturn', 'N/A')}%")
    print(f"  Max Drawdown: {rank1.get('maxDrawdown', 'N/A')}%")
    print(f"  Trades: {rank1.get('trades', 'N/A')}")
    print(f"  Data Source: {rank1.get('dataSource', 'N/A')}")
    
    # B. Heatmap对应格子
    print(f"\nB. Heatmap对应格子 (Short=15, Long=50):")
    # 在heatmap中，X轴是Short MA，Y轴是Long MA
    # 我们需要找到Short=15, Long=50的结果
    target_short = 15
    target_long = 50
    
    target_result = None
    for result in results:
        short_ma = result.get('short_ma', result.get('parameters', {}).get('shortMaPeriod'))
        long_ma = result.get('long_ma', result.get('parameters', {}).get('longMaPeriod'))
        
        if short_ma == target_short and long_ma == target_long:
            target_result = result
            break
    
    if target_result:
        print(f"  ✅ 找到对应结果:")
        print(f"    Rank: {target_result.get('rank', 'N/A')}")
        print(f"    Sharpe Ratio: {target_result.get('sharpeRatio', 'N/A')}")
        print(f"    Total Return: {target_result.get('totalReturn', 'N/A')}%")
        
        # 验证一致性
        rank1_sharpe = rank1.get('sharpeRatio', 0)
        target_sharpe = target_result.get('sharpeRatio', 0)
        
        if abs(rank1_sharpe - target_sharpe) < 0.05:  # 允许微小差异
            print(f"  ✅ Sharpe Ratio一致: {rank1_sharpe:.3f} ≈ {target_sharpe:.3f}")
        else:
            print(f"  ⚠️  Sharpe Ratio不一致: {rank1_sharpe:.3f} ≠ {target_sharpe:.3f}")
    else:
        print(f"  ❌ 未找到Short=15, Long=50的结果")
    
    # C. 随机抽2组验证
    print(f"\nC. 随机抽2组验证:")
    
    # 随机选择两个不同的组合
    import random
    if len(results) >= 3:
        samples = random.sample(results[1:], min(2, len(results)-1))
        
        for i, sample in enumerate(samples):
            short_ma = sample.get('short_ma', sample.get('parameters', {}).get('shortMaPeriod', 'N/A'))
            long_ma = sample.get('long_ma', sample.get('parameters', {}).get('longMaPeriod', 'N/A'))
            
            print(f"\n  样本 {i+1}: Short={short_ma}, Long={long_ma}")
            print(f"    Rank: {sample.get('rank', 'N/A')}")
            print(f"    Sharpe: {sample.get('sharpeRatio', 'N/A')}")
            print(f"    Return: {sample.get('totalReturn', 'N/A')}%")
            print(f"    Data Source: {sample.get('dataSource', 'N/A')}")
            
            # 验证数据源
            if 'Alpaca' in str(sample.get('dataSource', '')):
                print(f"    ✅ 数据源是Alpaca")
            else:
                print(f"    ❌ 数据源不是Alpaca")

if __name__ == "__main__":
    print("Parameter Optimization 全链路Alpaca证据收集")
    print("=" * 80)
    
    # 1. 捕获真实请求
    payload = capture_real_request()
    
    # 2. 检查后端日志证据
    check_backend_logs()
    
    # 3. 验证没有mock/fallback
    verify_no_mock_fallback()
    
    print(f"\n{'='*80}")
    print("注意: 要查看完整的后端日志证据，需要:")
    print("1. 在单独的控制台运行: python start_quant_backend.py")
    print("2. 查看控制台输出的完整日志")
    print("3. 确认日志中包含Alpaca API调用和historical_data信息")
    print(f"{'='*80}")