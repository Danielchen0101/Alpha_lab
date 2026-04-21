#!/usr/bin/env python3
"""
测试Parameter Optimization是否100%使用Alpaca数据
"""

import json
import requests
import time

def test_optimization_alpaca():
    """测试优化API是否只使用Alpaca数据"""
    
    # 测试配置
    test_cases = [
        {
            "name": "AAPL Moving Average Crossover 1 Year",
            "payload": {
                "symbol": "AAPL",
                "strategy": "moving_average",
                "startDate": "2025-04-01",
                "endDate": "2026-04-10",
                "initialCapital": 100000,
                "shortMaRange": {"start": 5, "end": 15, "step": 5},
                "longMaRange": {"start": 20, "end": 40, "step": 10}
            }
        }
    ]
    
    base_url = "http://127.0.0.1:8889"
    
    for test_case in test_cases:
        print(f"\n{'='*60}")
        print(f"测试: {test_case['name']}")
        print(f"{'='*60}")
        
        try:
            # 发送优化请求
            start_time = time.time()
            response = requests.post(
                f"{base_url}/api/backtest/optimize",
                json=test_case['payload'],
                timeout=60
            )
            elapsed = time.time() - start_time
            
            print(f"响应时间: {elapsed:.2f}秒")
            print(f"状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                print(f"成功: {data.get('success', False)}")
                print(f"错误信息: {data.get('error', 'None')}")
                print(f"优化ID: {data.get('optimizationId', 'None')}")
                
                # 检查数据源
                parameters = data.get('parameters', {})
                print(f"数据源: {parameters.get('dataSource', 'Not specified')}")
                print(f"历史数据点: {parameters.get('historicalDataPoints', 0)}")
                
                # 检查结果
                results = data.get('results', [])
                print(f"结果数量: {len(results)}")
                
                if results:
                    # 检查第一个结果的数据源
                    first_result = results[0]
                    print(f"第一个结果的数据源: {first_result.get('dataSource', 'Not specified')}")
                    print(f"第一个结果的数据点: {first_result.get('dataPoints', 0)}")
                    
                    # 检查是否有模拟数据警告
                    if 'warning' in first_result:
                        print(f"警告: {first_result['warning']}")
                    
                    # 打印前3个结果
                    print(f"\n前3个结果:")
                    for i, result in enumerate(results[:3]):
                        print(f"  {i+1}. Rank {result.get('rank', 'N/A')}: "
                              f"Return={result.get('totalReturn', 0):.2f}%, "
                              f"Sharpe={result.get('sharpeRatio', 0):.3f}, "
                              f"DD={result.get('maxDrawdown', 0):.2f}%")
                
                # 验证数据源是否为Alpaca
                if parameters.get('dataSource', '').startswith('Alpaca'):
                    print(f"\n✅ 验证通过: 数据源是Alpaca")
                else:
                    print(f"\n❌ 验证失败: 数据源不是Alpaca ({parameters.get('dataSource', 'Unknown')})")
                    
                # 验证没有模拟数据
                if any('SIMULATED' in str(r.get('dataSource', '')) for r in results):
                    print(f"❌ 验证失败: 发现模拟数据")
                else:
                    print(f"✅ 验证通过: 没有模拟数据")
                    
            else:
                print(f"请求失败: {response.status_code}")
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

if __name__ == "__main__":
    print("Parameter Optimization Alpaca数据源测试")
    print("确保后端服务正在运行 (python start_quant_backend.py)")
    test_optimization_alpaca()