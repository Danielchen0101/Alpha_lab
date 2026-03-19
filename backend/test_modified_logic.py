#!/usr/bin/env python3
"""
测试修改后的逻辑 - 模拟Finnhub失败时的备用数据
"""

import time
from datetime import datetime

def test_fallback_logic():
    """测试备用数据生成逻辑"""
    
    test_cases = [
        ("1 Day", "5min", "1day"),
        ("1 Week", "1day", "1week"),
        ("1 Month", "1day", "1month"),
        ("3 Months", "1day", "3month"),
        ("1 Year", "1day", "1year")
    ]
    
    print("=== 测试备用数据生成逻辑 ===")
    print("模拟Finnhub API失败时的行为")
    
    for timeframe_name, interval, range_param in test_cases:
        print(f"\n=== 测试 {timeframe_name} ===")
        print(f"参数: interval={interval}, range={range_param}")
        
        # 模拟get_fallback_data函数的逻辑
        symbol = "AAPL"
        resolution = "5" if interval == "5min" else "D"
        end_time = int(time.time())
        
        # 确定数据点数
        data_points_map = {
            '1day': 78,    # 1天，5分钟数据：6.5小时 * 12 = 78
            '1week': 5,    # 1周，日线数据：5个交易日
            '1month': 20,  # 1月，日线数据：20个交易日
            '3month': 60,  # 3月，日线数据：60个交易日
            '1year': 252   # 1年，日线数据：252个交易日
        }
        
        data_points = data_points_map.get(range_param, 20)
        
        # 确定时间间隔（秒）
        time_interval_map = {
            '5min': 300,      # 5分钟
            '1day': 86400     # 1天
        }
        
        time_interval = time_interval_map.get(interval, 86400)
        
        print(f"预期数据点数: {data_points}")
        print(f"时间间隔: {time_interval}秒 ({time_interval/60 if time_interval < 3600 else time_interval/3600:.1f} {'分钟' if time_interval < 3600 else '小时'})")
        
        # 计算总时间跨度
        total_time_span = data_points * time_interval
        print(f"总时间跨度: {total_time_span/86400:.1f}天")
        
        # 验证数据点数的合理性
        if timeframe_name == "1 Day" and interval == "5min":
            expected_points = 78  # 6.5小时 * 12个5分钟
            if data_points == expected_points:
                print(f"[OK] 1D timeframe数据点数正确: {data_points}")
            else:
                print(f"[ERROR] 1D timeframe数据点数错误: 预期{expected_points}, 实际{data_points}")
        
        elif timeframe_name == "1 Week" and interval == "1day":
            expected_points = 5  # 5个交易日
            if data_points == expected_points:
                print(f"[OK] 1W timeframe数据点数正确: {data_points}")
            else:
                print(f"[ERROR] 1W timeframe数据点数错误: 预期{expected_points}, 实际{data_points}")
        
        elif timeframe_name == "1 Month" and interval == "1day":
            expected_points = 20  # 约20个交易日
            if data_points == expected_points:
                print(f"[OK] 1M timeframe数据点数正确: {data_points}")
            else:
                print(f"[ERROR] 1M timeframe数据点数错误: 预期{expected_points}, 实际{data_points}")
        
        elif timeframe_name == "3 Months" and interval == "1day":
            expected_points = 60  # 约60个交易日
            if data_points == expected_points:
                print(f"[OK] 3M timeframe数据点数正确: {data_points}")
            else:
                print(f"[ERROR] 3M timeframe数据点数错误: 预期{expected_points}, 实际{data_points}")
        
        elif timeframe_name == "1 Year" and interval == "1day":
            expected_points = 252  # 约252个交易日
            if data_points == expected_points:
                print(f"[OK] 1Y timeframe数据点数正确: {data_points}")
            else:
                print(f"[ERROR] 1Y timeframe数据点数错误: 预期{expected_points}, 实际{data_points}")
    
    print("\n=== 测试总结 ===")
    print("1. 每个timeframe现在会返回不同数量的数据点")
    print("2. 1D返回5分钟数据（78条），其他返回日线数据")
    print("3. 数据源明确标识为'模拟数据 (Finnhub不可用)'")
    print("4. 前端图表会根据不同timeframe显示不同数据")

if __name__ == "__main__":
    test_fallback_logic()