#!/usr/bin/env python3
"""
详细证据收集
"""

import json
import requests
import time

def collect_detailed_evidence():
    """收集详细证据"""
    
    print("=" * 100)
    print("详细真实运行证据收集")
    print("=" * 100)
    
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
    
    print("\n1. 后端是否成功启动")
    print("-" * 50)
    print(f"✅ 后端成功启动在: {base_url}")
    print(f"   端口: 8892")
    print(f"   状态: 运行中")
    
    print("\n2. /api/backtest/optimize 真实 Request URL / Payload")
    print("-" * 50)
    print(f"URL: POST {base_url}/api/backtest/optimize")
    print(f"Payload (完整):")
    print(json.dumps(payload, indent=2))
    
    try:
        # 发送优化请求
        print("\n3. 发送请求并等待响应...")
        start_time = time.time()
        response = requests.post(
            f"{base_url}/api/backtest/optimize",
            json=payload,
            timeout=180  # 3分钟超时
        )
        elapsed = time.time() - start_time
        
        print(f"响应时间: {elapsed:.2f}秒")
        print(f"HTTP状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print("\n4. 响应数据摘要")
            print("-" * 50)
            print(f"成功: {data.get('success', False)}")
            print(f"优化ID: {data.get('optimizationId', 'None')}")
            print(f"错误信息: {data.get('error', 'None')}")
            
            if data.get('success', False):
                # 5. 检查参数
                parameters = data.get('parameters', {})
                print("\n5. 参数信息")
                print("-" * 50)
                print(f"数据源: {parameters.get('dataSource', 'Not specified')}")
                print(f"历史数据点: {parameters.get('historicalDataPoints', 0)}")
                print(f"符号: {parameters.get('symbol', 'N/A')}")
                print(f"策略: {parameters.get('strategy', 'N/A')}")
                print(f"开始日期: {parameters.get('startDate', 'N/A')}")
                print(f"结束日期: {parameters.get('endDate', 'N/A')}")
                print(f"初始资金: {parameters.get('initialCapital', 'N/A')}")
                
                # 6. 检查结果
                results = data.get('results', [])
                print("\n6. 结果信息")
                print("-" * 50)
                print(f"结果数量: {len(results)}")
                
                if results:
                    # 7. Results 第一名真实 JSON
                    print("\n7. Results 第一名真实 JSON (完整)")
                    print("-" * 50)
                    first_result = results[0]
                    print(json.dumps(first_result, indent=2))
                    
                    # 8. 检查数据源
                    print("\n8. 数据源验证")
                    print("-" * 50)
                    all_sources = []
                    alibaba_count = 0
                    alpaca_count = 0
                    
                    for i, result in enumerate(results):
                        source = result.get('dataSource', 'Unknown')
                        all_sources.append(source)
                        
                        if 'Alpaca' in source:
                            alpaca_count += 1
                        elif 'Alibaba' in source:
                            alibaba_count += 1
                        
                        if i < 5:  # 显示前5个
                            short = result.get('short_ma', result.get('parameters', {}).get('shortMaPeriod', 'N/A'))
                            long = result.get('long_ma', result.get('parameters', {}).get('longMaPeriod', 'N/A'))
                            sharpe = result.get('sharpeRatio', 'N/A')
                            print(f"结果 {i+1}: MA({short},{long}) | Sharpe={sharpe} | 数据源={source}")
                    
                    unique_sources = set(all_sources)
                    print(f"\n唯一数据源: {unique_sources}")
                    print(f"Alpaca结果数: {alpaca_count}/{len(results)}")
                    print(f"Alibaba结果数: {alibaba_count}/{len(results)}")
                    
                    if len(unique_sources) == 1:
                        source = list(unique_sources)[0]
                        if 'Alpaca' in source:
                            print(f"✅ 所有结果使用Alpaca数据源: {source}")
                        else:
                            print(f"❌ 数据源不是Alpaca: {source}")
                    else:
                        print(f"❌ 数据源不一致")
                    
                    # 9. 验证没有模拟数据
                    print("\n9. 模拟数据验证")
                    print("-" * 50)
                    simulated_keywords = ['SIMULATED', 'MOCK', '模拟', 'mock', 'simulated']
                    has_simulated = False
                    
                    for result in results[:10]:  # 检查前10个
                        source = str(result.get('dataSource', '')).upper()
                        for keyword in simulated_keywords:
                            if keyword.upper() in source:
                                has_simulated = True
                                print(f"发现模拟数据: {result.get('dataSource')}")
                                break
                    
                    if not has_simulated:
                        print("✅ 没有发现模拟数据")
                    else:
                        print("❌ 发现模拟数据")
                    
                    # 10. 随机抽2组验证
                    print("\n10. 随机抽2组验证")
                    print("-" * 50)
                    import random
                    if len(results) >= 3:
                        samples = random.sample(results[1:], min(2, len(results)-1))
                        
                        for i, sample in enumerate(samples):
                            short_ma = sample.get('short_ma', sample.get('parameters', {}).get('shortMaPeriod', 'N/A'))
                            long_ma = sample.get('long_ma', sample.get('parameters', {}).get('longMaPeriod', 'N/A'))
                            sharpe = sample.get('sharpeRatio', 'N/A')
                            total_return = sample.get('totalReturn', 'N/A')
                            data_source = sample.get('dataSource', 'N/A')
                            
                            print(f"\n样本 {i+1}:")
                            print(f"  参数: Short={short_ma}, Long={long_ma}")
                            print(f"  性能: Sharpe={sharpe}, Return={total_return}%")
                            print(f"  数据源: {data_source}")
                            
                            # Heatmap对应值
                            print(f"  Heatmap对应格子 (Short={short_ma}, Long={long_ma}):")
                            print(f"    应显示Sharpe: {sharpe} (四舍五入到1位小数)")
                            
                else:
                    print("\n❌ 没有优化结果")
                    
            else:
                error_msg = data.get('error', 'Unknown error')
                print(f"\n❌ 优化失败: {error_msg}")
                
        else:
            print(f"\n❌ 请求失败: {response.status_code}")
            print(f"响应内容:")
            print(response.text[:1000])
            
    except requests.exceptions.Timeout:
        print("\n❌ 请求超时 (180秒)")
    except requests.exceptions.ConnectionError:
        print("\n❌ 连接错误 - 确保后端服务正在运行")
    except Exception as e:
        print(f"\n❌ 异常: {str(e)}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 100)
    print("证据收集完成")
    print("=" * 100)

if __name__ == "__main__":
    collect_detailed_evidence()