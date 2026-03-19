#!/usr/bin/env python3
"""
测试Dashboard修复后的性能
"""

import time
import requests
import json

def test_dashboard_fix():
    """测试Dashboard修复后的性能"""
    print("=" * 80)
    print("Dashboard修复测试")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889/api"
    
    # 测试1: 普通请求（使用Polygon.io）
    print("\n1. 测试普通请求（Polygon.io）")
    print("-" * 40)
    
    start_time = time.time()
    try:
        response = requests.get(f"{base_url}/market/stocks", timeout=35)
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"[SUCCESS] 请求成功")
            print(f"   耗时: {elapsed:.2f}秒")
            print(f"   股票数量: {data.get('count', 0)}")
            print(f"   数据源: {data.get('dataSource', 'Unknown')}")
            print(f"   是否成功: {data.get('success', 'N/A')}")
        else:
            print(f"[ERROR] 请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"[ERROR] 请求异常: {str(e)}")
    
    # 测试2: Dashboard请求（使用Finnhub）
    print("\n2. 测试Dashboard请求（Finnhub）")
    print("-" * 40)
    
    start_time = time.time()
    try:
        response = requests.get(f"{base_url}/market/stocks?dashboard=true", timeout=35)
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"[SUCCESS] 请求成功")
            print(f"   耗时: {elapsed:.2f}秒")
            print(f"   股票数量: {data.get('count', 0)}")
            print(f"   数据源: {data.get('dataSource', 'Unknown')}")
            print(f"   是否成功: {data.get('success', 'N/A')}")
            
            # 检查数据
            stocks = data.get('stocks', [])
            if stocks:
                print(f"   示例数据:")
                for stock in stocks[:3]:  # 显示前3只股票
                    print(f"     {stock.get('symbol')}: ${stock.get('price')} "
                          f"(涨跌: {stock.get('changePercent', 0):.2f}%, "
                          f"市值: {stock.get('marketCap', 0)})")
            
            # 检查错误
            if data.get('errors'):
                print(f"   [WARNING] 错误: {len(data.get('errors'))}个")
                for error in data.get('errors')[:3]:
                    print(f"     {error}")
                    
        else:
            print(f"[ERROR] 请求失败: {response.status_code}")
            print(f"   响应: {response.text[:200]}")
            
    except Exception as e:
        print(f"[ERROR] 请求异常: {str(e)}")
    
    # 测试3: 性能对比
    print("\n3. 性能对比")
    print("-" * 40)
    
    print("   [COMPARISON] 修复前后对比:")
    print("   修复前（Polygon.io串行）:")
    print("     - 15只股票 × 2个API = 30个串行请求")
    print("     - 每个请求约1.5秒")
    print("     - 总耗时: ~16-20秒（接近超时）")
    print("")
    print("   修复后（Finnhub并发）:")
    print("     - 使用线程池并发处理（最多5个并发）")
    print("     - 每只股票最多10秒超时")
    print("     - Dashboard专用缓存（60秒）")
    print("     - 轻量级模式：只获取必要数据")
    print("     - 预期总耗时: ~5-10秒")
    
    print("\n4. 缓存测试")
    print("-" * 40)
    
    # 测试缓存效果
    print("   第一次请求（无缓存）...")
    start_time = time.time()
    try:
        response1 = requests.get(f"{base_url}/market/stocks?dashboard=true", timeout=35)
        elapsed1 = time.time() - start_time
        print(f"   耗时: {elapsed1:.2f}秒")
    except Exception as e:
        print(f"   失败: {str(e)}")
        elapsed1 = 0
    
    print("   第二次请求（有缓存）...")
    start_time = time.time()
    try:
        response2 = requests.get(f"{base_url}/market/stocks?dashboard=true", timeout=35)
        elapsed2 = time.time() - start_time
        print(f"   耗时: {elapsed2:.2f}秒")
        
        if elapsed2 < elapsed1 * 0.5:  # 缓存后应该快很多
            print(f"   [SUCCESS] 缓存生效！速度提升: {elapsed1/elapsed2:.1f}倍")
        else:
            print(f"   [WARNING] 缓存可能未生效")
            
    except Exception as e:
        print(f"   失败: {str(e)}")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    test_dashboard_fix()