#!/usr/bin/env python3
"""
Dashboard性能测试脚本（简化版）
分析当前Dashboard请求的性能瓶颈
"""

import time
import requests
import json
from datetime import datetime

def test_dashboard_performance():
    """测试Dashboard API性能"""
    print("=" * 80)
    print("Dashboard性能测试")
    print("=" * 80)
    
    # 测试URL
    base_url = "http://127.0.0.1:8889/api"
    
    # 测试1: 获取默认股票列表（15只股票）
    print("\n1. 测试默认股票列表（15只股票）")
    print("-" * 40)
    
    start_time = time.time()
    
    try:
        response = requests.get(f"{base_url}/market/stocks", timeout=35)
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"[SUCCESS] 请求成功")
            print(f"   状态码: {response.status_code}")
            print(f"   总耗时: {elapsed:.2f}秒")
            print(f"   股票数量: {data.get('count', 0)}")
            print(f"   数据源: {data.get('dataSource', 'Unknown')}")
            
            # 检查是否有错误
            stocks = data.get('stocks', [])
            errors = [s for s in stocks if s.get('error')]
            if errors:
                print(f"   [WARNING] 错误股票: {len(errors)}只")
                for error_stock in errors[:3]:  # 只显示前3个错误
                    print(f"      {error_stock.get('symbol')}: {error_stock.get('error')}")
            
            # 检查超时情况
            if elapsed > 30:
                print(f"   [ERROR] 超时警告: 请求耗时超过30秒 ({elapsed:.2f}秒)")
            elif elapsed > 20:
                print(f"   [WARNING] 性能警告: 请求耗时较长 ({elapsed:.2f}秒)")
            else:
                print(f"   [SUCCESS] 性能正常: 请求耗时合理 ({elapsed:.2f}秒)")
                
        else:
            print(f"[ERROR] 请求失败")
            print(f"   状态码: {response.status_code}")
            print(f"   响应: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        elapsed = time.time() - start_time
        print(f"[ERROR] 请求超时")
        print(f"   总耗时: {elapsed:.2f}秒")
        print(f"   超时时间: 30秒")
        
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"[ERROR] 请求异常: {str(e)}")
        print(f"   总耗时: {elapsed:.2f}秒")
    
    # 测试2: 测试单个股票的性能
    print("\n2. 测试单个股票性能")
    print("-" * 40)
    
    test_symbols = ["AAPL", "MSFT", "GOOGL"]
    
    for symbol in test_symbols:
        start_time = time.time()
        try:
            response = requests.get(f"{base_url}/market/stock/{symbol}", timeout=10)
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                print(f"   {symbol}: [SUCCESS] {elapsed:.2f}秒")
            else:
                print(f"   {symbol}: [ERROR] {elapsed:.2f}秒 (状态码: {response.status_code})")
                
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"   {symbol}: [ERROR] {elapsed:.2f}秒 (异常: {str(e)[:50]})")
    
    # 测试3: 分析当前代码的性能瓶颈
    print("\n3. 性能瓶颈分析")
    print("-" * 40)
    
    print("   [ANALYSIS] 当前问题分析:")
    print("   1. API路由使用Polygon.io服务（串行处理）")
    print("   2. 每只股票需要2个API调用：")
    print("      - get_ticker_details()")
    print("      - get_previous_close()")
    print("   3. 15只股票 × 2个API = 30个串行请求")
    print("   4. 每个API调用都有网络延迟")
    print("   5. 没有并发处理")
    print("   6. 没有Dashboard专用缓存")
    
    print("\n   [SOLUTION] 建议解决方案:")
    print("   1. 修改API路由，支持dashboard参数")
    print("   2. 当dashboard=true时，使用Finnhub服务（并发处理）")
    print("   3. 添加Dashboard专用缓存（60秒）")
    print("   4. 减少股票数量或优化数据获取")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    test_dashboard_performance()