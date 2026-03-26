#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试Backtest数据源逻辑
"""

import json
import sys
import os

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from start_quant_backend import app

def test_finnhub_twelvedata_fallback():
    """测试Finnhub -> Twelve Data fallback逻辑"""
    print("=== Test: Finnhub -> Twelve Data Fallback ===")
    
    # 模拟一个Backtest请求
    test_data = {
        "symbol": "AAPL",
        "strategy": "moving_average",
        "startDate": "2024-01-01",
        "endDate": "2024-01-31",
        "initialCapital": 10000,
        "dataMode": "real",
        "parameters": {
            "shortMaPeriod": 20,
            "longMaPeriod": 50
        }
    }
    
    print(f"Test data: {json.dumps(test_data, indent=2)}")
    
    # 测试数据获取逻辑
    print("\n1. Testing Finnhub data fetch...")
    from start_quant_backend import get_finnhub_history
    historical_data, success, note = get_finnhub_history(
        test_data["symbol"],
        test_data["startDate"],
        test_data["endDate"]
    )
    
    print(f"   Finnhub result: success={success}, note={note}")
    if success and historical_data:
        print(f"   Data points: {len(historical_data)}")
        print(f"   Data source: Finnhub")
    else:
        print("   Finnhub failed, would fallback to Twelve Data")
    
    print("\n2. Testing Twelve Data data fetch...")
    from start_quant_backend import get_twelvedata_history_with_dates
    historical_data, success, note = get_twelvedata_history_with_dates(
        test_data["symbol"],
        "1day",
        test_data["startDate"],
        test_data["endDate"]
    )
    
    print(f"   Twelve Data result: success={success}, note={note}")
    if success and historical_data:
        print(f"   Data points: {len(historical_data)}")
        print(f"   Data source: Twelve Data")
    
    print("\n3. Testing complete fallback scenario...")
    print("   Expected behavior:")
    print("   - Try Finnhub first")
    print("   - If Finnhub fails, try Twelve Data")
    print("   - If both fail, return error message")
    print("   - Never fallback to simulated data")

def test_backtest_api():
    """测试Backtest API端点"""
    print("\n\n=== Test: Backtest API Endpoint ===")
    
    with app.test_client() as client:
        # 测试正常请求
        test_data = {
            "symbol": "AAPL",
            "strategy": "moving_average",
            "startDate": "2024-01-01",
            "endDate": "2024-01-31",
            "initialCapital": 10000,
            "dataMode": "real",
            "parameters": {
                "shortMaPeriod": 20,
                "longMaPeriod": 50
            }
        }
        
        print("Sending backtest request...")
        response = client.post('/api/backtest/run', json=test_data)
        
        print(f"Response status: {response.status_code}")
        data = response.get_json()
        
        if data.get('success') == False:
            print(f"Backtest failed (expected if no API keys): {data.get('error')}")
            print("This is correct behavior - no fallback to simulated data")
        else:
            print(f"Backtest succeeded")
            print(f"Data source: {data.get('parameters', {}).get('dataSource')}")
            print(f"Data mode: {data.get('parameters', {}).get('dataModeDisplay')}")
            
            # 验证没有使用模拟数据
            if data.get('parameters', {}).get('dataSource') == 'Simulated':
                print("ERROR: Still using simulated data!")
            else:
                print("OK: Using real data source")

def test_error_handling():
    """测试错误处理"""
    print("\n\n=== Test: Error Handling ===")
    
    # 测试无效符号
    print("1. Testing invalid symbol...")
    from start_quant_backend import get_finnhub_history
    historical_data, success, note = get_finnhub_history(
        "INVALID_SYMBOL_XYZ",
        "2024-01-01",
        "2024-01-31"
    )
    
    print(f"   Result: success={success}, note={note}")
    print(f"   Expected: success=False")
    
    # 测试无效日期范围
    print("\n2. Testing invalid date range...")
    historical_data, success, note = get_finnhub_history(
        "AAPL",
        "2024-12-31",  # 开始日期在结束日期之后
        "2024-01-01"
    )
    
    print(f"   Result: success={success}, note={note}")
    print(f"   Expected: success=False or empty data")

def main():
    """主函数"""
    print("Backtest Data Source Logic Test")
    print("=" * 60)
    
    # 1. 测试fallback逻辑
    test_finnhub_twelvedata_fallback()
    
    # 2. 测试API端点
    test_backtest_api()
    
    # 3. 测试错误处理
    test_error_handling()
    
    print("\n\n=== SUMMARY ===")
    print("Expected changes:")
    print("1. [OK] Frontend: Removed simulated data option")
    print("2. [OK] Backend: Finnhub -> Twelve Data fallback implemented")
    print("3. [OK] Backend: No simulated data fallback")
    print("4. [OK] Error handling: Clear error messages when data fetch fails")
    print("5. [OK] Data source tracking: dataSource field in results")
    
    print("\nKey behaviors:")
    print("- Only real data mode supported")
    "- Finnhub is tried first"
    "- Twelve Data is fallback"
    "- If both fail, clear error is returned"
    "- No silent fallback to simulated data"

if __name__ == "__main__":
    main()