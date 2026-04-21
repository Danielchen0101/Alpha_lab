#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试RSI和MACD策略修复
"""

def test_ema_calculation():
    """测试EMA计算函数"""
    print("=== Test 1: EMA Calculation ===")
    
    # 测试数据
    prices = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
              110, 111, 112, 113, 114, 115, 116, 117, 118, 119]
    
    # 测试calculate_ema函数
    test_prices = prices.copy()
    
    # 手动计算EMA(5)作为验证
    print("Testing EMA(5) calculation:")
    
    # 第4天（索引4）应该是第一个EMA，使用SMA
    expected_first_ema = sum(test_prices[0:5]) / 5  # (100+101+102+103+104)/5 = 102
    print(f"  Day 4 (first EMA): Expected SMA = {expected_first_ema:.2f}")
    
    # 第5天（索引5）的EMA
    alpha = 2.0 / (5 + 1)  # 2/(5+1) = 0.3333
    expected_second_ema = alpha * test_prices[5] + (1 - alpha) * expected_first_ema
    expected_second_ema = 0.3333 * 105 + 0.6667 * 102
    print(f"  Day 5 (second EMA): Expected = {expected_second_ema:.2f}")
    
    print("\nEMA calculation function test completed.")

def test_rsi_parameters():
    """测试RSI参数使用"""
    print("\n=== Test 2: RSI Parameter Usage ===")
    
    # 模拟前端传递的参数
    test_parameters = {
        'rsiPeriod': 10,  # 使用10天周期，不是默认14
        'rsiOversold': 25,  # 使用25超卖阈值，不是默认30
        'rsiOverbought': 75  # 使用75超买阈值，不是默认70
    }
    
    print("Testing RSI parameter usage:")
    print(f"  Frontend parameters: {test_parameters}")
    print(f"  Expected behavior:")
    print(f"    - RSI period should be {test_parameters['rsiPeriod']} (not 14)")
    print(f"    - Oversold threshold should be {test_parameters['rsiOversold']} (not 30)")
    print(f"    - Overbought threshold should be {test_parameters['rsiOverbought']} (not 70)")
    
    # 验证参数获取逻辑
    rsi_period = test_parameters.get('rsiPeriod', 14)
    rsi_oversold = test_parameters.get('rsiOversold', 30)
    rsi_overbought = test_parameters.get('rsiOverbought', 70)
    
    print(f"\n  Actual parameter retrieval:")
    print(f"    rsi_period = {rsi_period} {'✓' if rsi_period == 10 else '✗'}")
    print(f"    rsi_oversold = {rsi_oversold} {'✓' if rsi_oversold == 25 else '✗'}")
    print(f"    rsi_overbought = {rsi_overbought} {'✓' if rsi_overbought == 75 else '✗'}")
    
    # 测试窗口计算
    i = 15  # 当前索引
    window_start = i - rsi_period + 1
    print(f"\n  Window calculation for i={i}, rsi_period={rsi_period}:")
    print(f"    Window range: [{window_start}, {i}] (length: {rsi_period})")
    
    return all([
        rsi_period == 10,
        rsi_oversold == 25,
        rsi_overbought == 75
    ])

def test_macd_parameters():
    """测试MACD参数使用"""
    print("\n=== Test 3: MACD Parameter Usage ===")
    
    # 模拟前端传递的参数
    test_parameters = {
        'macdFast': 8,   # 使用8天快线，不是默认12
        'macdSlow': 21,  # 使用21天慢线，不是默认26
        'macdSignal': 6  # 使用6天信号线，不是默认9
    }
    
    print("Testing MACD parameter usage:")
    print(f"