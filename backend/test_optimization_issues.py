#!/usr/bin/env python3
"""
测试Parameter Optimization的显示问题：
1. Rank顺序是否正确
2. Max DD相同值问题
3. 数据一致性
"""

import json
import requests
import time
import statistics

def test_optimization_issues():
    """测试优化结果的显示问题"""
    
    # 测试配置
    payload = {
        "symbol": "AAPL",
        "strategy": "moving_average",
        "startDate": "2025-10-01",
        "endDate": "2026-04-10",
        "initialCapital": 100000,
        "shortMaRange": {"start": 5, "end": 15, "step": 5},
        "longMaRange": {"start": 20, "end": 40, "step": 10}
    }
    
    base_url = "http://127.0.0.1:8889"
    
    print(f"\n{'='*60}")
    print(f"测试: Parameter Optimization 显示问题")
    print(f"{'='*60}")
    
    try:
        # 发送优化请求
        start_time = time.time()
        response = requests.post(
            f"{base_url}/api/backtest/optimize",
            json=payload,
            timeout=60
        )
        elapsed = time.time() - start_time
        
        print(f"响应时间: {elapsed:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('success', False):
                results = data.get('results', [])
                print(f"结果数量: {len(results)}")
                
                if results:
                    # 1. 检查Rank顺序
                    print(f"\n1. Rank顺序检查:")
                    ranks = [r.get('rank', 0) for r in results]
                    expected_ranks = list(range(1, len(results) + 1))
                    
                    if ranks == expected_ranks:
                        print(f"   ✅ Rank顺序正确: {ranks}")
                    else:
                        print(f"   ❌ Rank顺序错误")
                        print(f"     实际: {ranks}")
                        print(f"     期望: {expected_ranks}")
                    
                    # 2. 检查Max DD相同值问题
                    print(f"\n2. Max DD相同值检查:")
                    max_dds = [r.get('maxDrawdown', 0) for r in results]
                    unique_max_dds = set(max_dds)
                    
                    if len(unique_max_dds) == len(results):
                        print(f"   ✅ 所有Max DD值都不同")
                        print(f"     Max DD范围: {min(max_dds):.2f}% 到 {max(max_dds):.2f}%")
                    else:
                        print(f"   ⚠️  发现重复的Max DD值")
                        print(f"     唯一值数量: {len(unique_max_dds)} / {len(results)}")
                        
                        # 找出重复的值
                        from collections import Counter
                        dd_counts = Counter(max_dds)
                        duplicates = {k: v for k, v in dd_counts.items() if v > 1}
                        if duplicates:
                            print(f"     重复的Max DD值: {duplicates}")
                    
                    # 3. 检查数据一致性（同一参数组合重复运行）
                    print(f"\n3. 数据一致性检查:")
                    print(f"   需要手动测试：同一参数组合运行两次，结果应该一致")
                    print(f"   测试方法：重新运行相同的优化请求，比较结果")
                    
                    # 4. 检查Sharpe Ratio排序
                    print(f"\n4. Sharpe Ratio排序检查:")
                    sharpe_ratios = [r.get('sharpeRatio', 0) for r in results]
                    
                    # 检查是否按Sharpe Ratio降序排列（rank 1应该是最高的）
                    if ranks[0] == 1:
                        best_sharpe = max(sharpe_ratios)
                        actual_best_sharpe = sharpe_ratios[0]
                        
                        if abs(best_sharpe - actual_best_sharpe) < 0.001:
                            print(f"   ✅ Rank 1有最高的Sharpe Ratio: {actual_best_sharpe:.3f}")
                        else:
                            print(f"   ❌ Rank 1不是最高的Sharpe Ratio")
                            print(f"     Rank 1的Sharpe: {actual_best_sharpe:.3f}")
                            print(f"     最高的Sharpe: {best_sharpe:.3f}")
                    
                    # 5. 检查参数组合
                    print(f"\n5. 参数组合检查:")
                    param_combinations = []
                    for result in results:
                        params = result.get('parameters', {})
                        short_ma = params.get('shortMaPeriod', params.get('short_ma', 0))
                        long_ma = params.get('longMaPeriod', params.get('long_ma', 0))
                        param_combinations.append((short_ma, long_ma))
                    
                    unique_combinations = set(param_combinations)
                    print(f"   唯一参数组合数量: {len(unique_combinations)} / {len(results)}")
                    
                    if len(unique_combinations) == len(results):
                        print(f"   ✅ 所有参数组合都不同")
                    else:
                        print(f"   ❌ 发现重复的参数组合")
                    
                    # 6. 打印前5个结果
                    print(f"\n6. 前5个结果:")
                    for i, result in enumerate(results[:5]):
                        params = result.get('parameters', {})
                        short_ma = params.get('shortMaPeriod', params.get('short_ma', 'N/A'))
                        long_ma = params.get('longMaPeriod', params.get('long_ma', 'N/A'))
                        
                        print(f"   Rank {result.get('rank', 'N/A')}: "
                              f"MA({short_ma},{long_ma}) | "
                              f"Return={result.get('totalReturn', 0):.2f}% | "
                              f"Sharpe={result.get('sharpeRatio', 0):.3f} | "
                              f"DD={result.get('maxDrawdown', 0):.2f}% | "
                              f"Trades={result.get('trades', 0)}")
                    
                    # 7. 检查数据源
                    print(f"\n7. 数据源检查:")
                    data_sources = [r.get('dataSource', 'Unknown') for r in results]
                    unique_sources = set(data_sources)
                    
                    if len(unique_sources) == 1 and 'Alpaca' in list(unique_sources)[0]:
                        print(f"   ✅ 所有结果都使用Alpaca数据源: {list(unique_sources)[0]}")
                    else:
                        print(f"   ❌ 数据源不一致: {unique_sources}")
                        
                else:
                    print(f"❌ 没有优化结果")
                    
            else:
                print(f"❌ 优化失败: {data.get('error', 'Unknown error')}")
                
        else:
            print(f"❌ 请求失败: {response.status_code}")
            print(f"响应内容: {response.text[:500]}")
            
    except requests.exceptions.Timeout:
        print(f"❌ 请求超时 (60秒)")
    except requests.exceptions.ConnectionError:
        print(f"❌ 连接错误 - 确保后端服务正在运行")
    except Exception as e:
        print(f"❌ 异常: {str(e)}")
    
    print(f"\n{'='*60}")
    print("测试完成")
    print(f"{'='*60}")

def test_consistency():
    """测试同一参数组合重复运行的一致性"""
    print(f"\n{'='*60}")
    print(f"测试: 数据一致性（重复运行）")
    print(f"{'='*60}")
    
    payload = {
        "symbol": "AAPL",
        "strategy": "moving_average",
        "startDate": "2025-10-01",
        "endDate": "2026-04-10",
        "initialCapital": 100000,
        "shortMaRange": {"start": 10, "end": 10, "step": 1},  # 固定一个值
        "longMaRange": {"start": 30, "end": 30, "step": 1}    # 固定一个值
    }
    
    base_url = "http://127.0.0.1:8889"
    
    results = []
    
    for i in range(3):  # 运行3次
        try:
            print(f"\n运行 #{i+1}:")
            response = requests.post(
                f"{base_url}/api/backtest/optimize",
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('success', False):
                    run_results = data.get('results', [])
                    if run_results:
                        result = run_results[0]  # 应该只有一个结果
                        results.append({
                            'totalReturn': result.get('totalReturn', 0),
                            'sharpeRatio': result.get('sharpeRatio', 0),
                            'maxDrawdown': result.get('maxDrawdown', 0),
                            'trades': result.get('trades', 0)
                        })
                        print(f"   Return: {result.get('totalReturn', 0):.2f}%, "
                              f"Sharpe: {result.get('sharpeRatio', 0):.3f}, "
                              f"DD: {result.get('maxDrawdown', 0):.2f}%, "
                              f"Trades: {result.get('trades', 0)}")
                    else:
                        print(f"   ❌ 没有结果")
                else:
                    print(f"   ❌ 失败: {data.get('error', 'Unknown')}")
            else:
                print(f"   ❌ HTTP错误: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 异常: {str(e)}")
    
    # 检查一致性
    if len(results) >= 2:
        print(f"\n一致性检查:")
        
        # 检查所有运行的结果是否相同
        all_same = all(
            abs(results[0]['totalReturn'] - r['totalReturn']) < 0.01 and
            abs(results[0]['sharpeRatio'] - r['sharpeRatio']) < 0.001 and
            abs(results[0]['maxDrawdown'] - r['maxDrawdown']) < 0.01 and
            results[0]['trades'] == r['trades']
            for r in results
        )
        
        if all_same:
            print(f"   ✅ 所有运行结果一致")
        else:
            print(f"   ❌ 运行结果不一致")
            for i, r in enumerate(results):
                print(f"   运行 #{i+1}: Return={r['totalReturn']:.2f}%, "
                      f"Sharpe={r['sharpeRatio']:.3f}, "
                      f"DD={r['maxDrawdown']:.2f}%, "
                      f"Trades={r['trades']}")

if __name__ == "__main__":
    print("Parameter Optimization 显示问题测试")
    print("确保后端服务正在运行 (python start_quant_backend.py)")
    
    test_optimization_issues()
    test_consistency()