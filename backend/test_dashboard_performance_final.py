#!/usr/bin/env python3
"""
测试Dashboard性能优化效果
"""

import time
import requests
import json

def test_dashboard_performance():
    """测试Dashboard性能"""
    print("=" * 80)
    print("Dashboard性能优化测试")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889/api"
    
    # 测试1: Dashboard请求（优化版）
    print("\n1. 测试Dashboard请求 (dashboard=true)")
    print("-" * 80)
    
    for i in range(3):  # 测试3次，检查缓存效果
        print(f"\n第 {i+1} 次请求:")
        
        start_time = time.time()
        try:
            response = requests.get(f"{base_url}/market/stocks?dashboard=true", timeout=30)
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                print(f"  [SUCCESS] 请求成功 ({elapsed:.2f}秒)")
                print(f"    股票数量: {data.get('count', 0)}")
                print(f"    数据源: {data.get('source', 'Unknown')}")
                print(f"    是否成功: {data.get('success', 'N/A')}")
                print(f"    耗时: {data.get('elapsed', 0):.2f}秒")
                
                if data.get('errors'):
                    print(f"    错误数量: {len(data.get('errors'))}")
                    for error in data.get('errors')[:2]:
                        print(f"      {error}")
                
                # 检查数据
                stocks = data.get('stocks', [])
                if stocks:
                    print(f"    示例数据:")
                    for stock in stocks[:2]:
                        print(f"      {stock.get('symbol')}: ${stock.get('price')} "
                              f"(涨跌: {stock.get('changePercent', 0):.2f}%)")
                
                # 性能评估
                if elapsed > 20:
                    print(f"  [WARNING] 性能警告: 请求耗时较长 ({elapsed:.2f}秒)")
                elif elapsed > 10:
                    print(f"  [INFO] 性能一般: 请求耗时 ({elapsed:.2f}秒)")
                else:
                    print(f"  [SUCCESS] 性能良好: 请求快速 ({elapsed:.2f}秒)")
                    
            else:
                print(f"  [ERROR] 请求失败: {response.status_code}")
                print(f"    响应: {response.text[:200]}")
                
        except requests.exceptions.Timeout:
            elapsed = time.time() - start_time
            print(f"  [ERROR] 请求超时 ({elapsed:.2f}秒)")
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"  [ERROR] 请求异常: {str(e)} ({elapsed:.2f}秒)")
    
    # 测试2: 普通请求（对比）
    print("\n2. 测试普通请求 (dashboard=false)")
    print("-" * 80)
    
    start_time = time.time()
    try:
        response = requests.get(f"{base_url}/market/stocks", timeout=30)
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"  [SUCCESS] 请求成功 ({elapsed:.2f}秒)")
            print(f"    股票数量: {data.get('count', 0)}")
            print(f"    数据源: {data.get('source', 'Unknown')}")
            print(f"    是否成功: {data.get('success', 'N/A')}")
            print(f"    耗时: {data.get('elapsed', 0):.2f}秒")
        else:
            print(f"  [ERROR] 请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"  [ERROR] 请求异常: {str(e)}")
    
    # 测试3: 检查缓存效果
    print("\n3. 缓存效果分析")
    print("-" * 80)
    
    print("  优化措施:")
    print("  1. 股票数量: 15支 → 8支 (临时)")
    print("  2. 数据字段: 完整数据 → 核心字段 (7个字段)")
    print("  3. 请求方式: 串行 → 并发 (最多4个线程)")
    print("  4. 缓存机制: 无缓存 → 60秒缓存")
    print("  5. 超时控制: 每只股票最多8秒")
    
    print("\n  预期效果:")
    print("  - 第一次请求: ~5-10秒 (无缓存)")
    print("  - 第二次请求: ~0.1-0.5秒 (缓存命中)")
    print("  - 成功率: >90%")
    print("  - 超时率: <10%")
    
    print("\n4. 前端集成检查")
    print("-" * 80)
    
    print("  前端需要:")
    print("  1. Dashboard调用: marketDataService.getStocks(undefined, true)")
    print("  2. 错误处理: 成功后清除error state")
    print("  3. 加载状态: 显示loading，成功后隐藏")
    print("  4. 数据更新: 每60秒自动刷新")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    test_dashboard_performance()