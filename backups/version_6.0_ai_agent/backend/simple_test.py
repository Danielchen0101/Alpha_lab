#!/usr/bin/env python3
"""
简单测试脚本 - 避免编码问题
"""

import json
import requests
import time

def simple_test():
    """简单测试"""
    
    print("=" * 80)
    print("简单测试 - 收集真实证据")
    print("=" * 80)
    
    # 固定测试配置
    payload = {
        "symbol": "AAPL",
        "strategy": "moving_average",
        "startDate": "2025-04-01",
        "endDate": "2026-04-10",
        "initialCapital": 100000,
        "shortMaRange": {"start": 5, "end": 25, "step": 5},
        "longMaRange": {"start": 50, "end": 200, "step": 25}
    }
    
    base_url = "http://127.0.0.1:8892"
    
    print("\n1. 真实请求信息")
    print("-" * 40)
    print(f"Request URL: POST {base_url}/api/backtest/optimize")
    print(f"Request Payload:")
    print(json.dumps(payload, indent=2))
    
    try:
        # 发送优化请求
        print("\n发送请求...")
        start_time = time.time()
        response = requests.post(
            f"{base_url}/api/backtest/optimize",
            json=payload,
            timeout=120
        )
        elapsed = time.time() - start_time
        
        print(f"响应时间: {elapsed:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print("\n2. 响应数据")
            print("-" * 40)
            print(f"成功: {data.get('success', False)}")
            print(f"优化ID: {data.get('optimizationId', 'None')}")
            
            if data.get('success', False):
                # 3. 检查参数
                parameters = data.get('parameters', {})
                print("\n3. 参数信息")
                print("-" * 40)
                print(f"数据源: {parameters.get('dataSource', 'Not specified')}")
                print(f"历史数据点: {parameters.get('historicalDataPoints', 0)}")
                
                # 4. 检查结果
                results = data.get('results', [])
                print("\n4. 结果信息")
                print("-" * 40)
                print(f"结果数量: {len(results)}")
                
                if results:
                    # 5. Results 第一名真实 JSON
                    print("\n5. Results 第一名真实 JSON")
                    print("-" * 40)
                    first_result = results[0]
                    
                    # 简化显示
                    simplified = {
                        'rank': first_result.get('rank'),
                        'short_ma': first_result.get('short_ma', first_result.get('parameters', {}).get('shortMaPeriod')),
                        'long_ma': first_result.get('long_ma', first_result.get('parameters', {}).get('longMaPeriod')),
                        'totalReturn': first_result.get('totalReturn'),
                        'sharpeRatio': first_result.get('sharpeRatio'),
                        'maxDrawdown': first_result.get('maxDrawdown'),
                        'trades': first_result.get('trades'),
                        'dataSource': first_result.get('dataSource'),
                        'dataPoints': first_result.get('dataPoints')
                    }
                    print(json.dumps(simplified, indent=2))
                    
                    # 6. 检查数据源
                    print("\n6. 数据源验证")
                    print("-" * 40)
                    all_sources = []
                    for i, result in enumerate(results[:3]):  # 只检查前3个
                        source = result.get('dataSource', 'Unknown')
                        all_sources.append(source)
                        print(f"结果 {i+1}: {source}")
                    
                    unique_sources = set(all_sources)
                    if len(unique_sources) == 1:
                        source = list(unique_sources)[0]
                        print(f"\n所有结果使用相同数据源: {source}")
                        if 'Alpaca' in source:
                            print("PASS: 数据源是Alpaca")
                        else:
                            print("FAIL: 数据源不是Alpaca")
                    else:
                        print(f"\nFAIL: 数据源不一致: {unique_sources}")
                    
                    # 7. 验证没有模拟数据
                    print("\n7. 模拟数据验证")
                    print("-" * 40)
                    has_simulated = any('SIMULATED' in str(r.get('dataSource', '')) for r in results[:3])
                    has_mock = any('mock' in str(r.get('dataSource', '')).lower() for r in results[:3])
                    
                    if not has_simulated and not has_mock:
                        print("PASS: 没有发现模拟数据")
                    else:
                        print("FAIL: 发现模拟数据")
                        
                else:
                    print("\nFAIL: 没有优化结果")
                    
            else:
                error_msg = data.get('error', 'Unknown error')
                print(f"\nFAIL: 优化失败: {error_msg}")
                
        else:
            print(f"\nFAIL: 请求失败: {response.status_code}")
            print(f"响应内容 (前500字符):")
            print(response.text[:500])
            
    except requests.exceptions.Timeout:
        print("\nFAIL: 请求超时 (120秒)")
    except requests.exceptions.ConnectionError:
        print("\nFAIL: 连接错误 - 确保后端服务正在运行")
    except Exception as e:
        print(f"\nFAIL: 异常: {str(e)}")
    
    print("\n" + "=" * 80)
    print("测试完成")
    print("=" * 80)

if __name__ == "__main__":
    simple_test()