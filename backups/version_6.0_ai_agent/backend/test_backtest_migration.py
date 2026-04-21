#!/usr/bin/env python3
"""
测试 Backtest 数据源迁移到 Alpaca
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入必要的函数
from start_quant_backend import get_alpaca_history_for_backtest

def test_alpaca_backtest_history():
    """测试 Alpaca backtest 历史数据获取"""
    print("=== 测试 Alpaca Backtest 历史数据获取 ===")
    
    # 测试用例 1: 正常日期范围
    print("\n测试用例 1: 正常日期范围 (AAPL, 2024-01-01 到 2024-01-10)")
    symbol = "AAPL"
    interval = "1day"
    range_param = "2024-01-01 to 2024-01-10"
    
    historical_data, success, data_source = get_alpaca_history_for_backtest(symbol, interval, range_param)
    
    if success:
        print(f"[OK] 成功获取数据: {data_source}")
        print(f"  数据点数: {len(historical_data)}")
        if historical_data:
            print(f"  第一条数据: {historical_data[0]}")
            print(f"  最后一条数据: {historical_data[-1]}")
    else:
        print(f"[FAIL] 获取失败: {data_source}")
    
    # 测试用例 2: 较长的日期范围
    print("\n测试用例 2: 较长日期范围 (AAPL, 2024-01-01 到 2024-03-01)")
    range_param = "2024-01-01 to 2024-03-01"
    
    historical_data, success, data_source = get_alpaca_history_for_backtest(symbol, interval, range_param)
    
    if success:
        print(f"[OK] 成功获取数据: {data_source}")
        print(f"  数据点数: {len(historical_data)}")
    else:
        print(f"[FAIL] 获取失败: {data_source}")
        print(f"  错误信息: {data_source}")
    
    # 测试用例 3: 无效的日期范围格式
    print("\n测试用例 3: 无效的日期范围格式")
    range_param = "2024-01-01"
    
    historical_data, success, data_source = get_alpaca_history_for_backtest(symbol, interval, range_param)
    
    if success:
        print(f"[OK] 成功获取数据: {data_source}")
    else:
        print(f"[FAIL] 预期失败: {data_source}")
    
    print("\n=== 测试完成 ===")

if __name__ == "__main__":
    test_alpaca_backtest_history()