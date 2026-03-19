#!/usr/bin/env python3
"""
测试修复结果
"""

import requests
import json
import time

def test_fix_result():
    """测试修复结果"""
    print("测试Day Low/Day High修复结果")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 测试1: 普通Market页调用
        print("1. 普通Market页调用（不带dashboard）:")
        print("-" * 60)
        
        symbols = 'AAPL,MSFT,GOOGL'
        response = requests.get(f"{base_url}/market/stocks?symbols={symbols}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            if stocks:
                print(f"返回 {len(stocks)} 支股票")
                
                for i, stock in enumerate(stocks, 1):
                    symbol = stock.get('symbol', 'N/A')
                    day_high = stock.get('dayHigh')
                    day_low = stock.get('dayLow')
                    
                    print(f"{i}. {symbol}:")
                    print(f"   dayHigh: {day_high}")
                    print(f"   dayLow: {day_low}")
                    
                    # 检查是否为有效值
                    if day_high is not None and day_high != 0:
                        print(f"   ✅ dayHigh有效: {day_high}")
                    else:
                        print(f"   ❌ dayHigh无效或为0")
                    
                    if day_low is not None and day_low != 0:
                        print(f"   ✅ dayLow有效: {day_low}")
                    else:
                        print(f"   ❌ dayLow无效或为0")
            else:
                print(f"没有返回股票数据")
        else:
            print(f"请求失败: {response.status_code}")
        
        # 测试2: Dashboard模式调用
        print(f"\n2. Dashboard模式调用（带dashboard=true）:")
        print("-" * 60)
        
        timestamp = int(time.time() * 1000)
        response = requests.get(f"{base_url}/market/stocks?dashboard=true&_={timestamp}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            if stocks:
                print(f"返回 {len(stocks)} 支股票")
                
                # 检查第一支股票
                stock = stocks[0]
                symbol = stock.get('symbol', 'N/A')
                day_high = stock.get('dayHigh')
                day_low = stock.get('dayLow')
                
                print(f"第一支股票 {symbol}:")
                print(f"  dayHigh: {day_high}")
                print(f"  dayLow: {day_low}")
                
                # 检查所有字段
                print(f"\n所有字段:")
                for key, value in stock.items():
                    print(f"  {key}: {value}")
            else:
                print(f"没有返回股票数据")
        else:
            print(f"请求失败: {response.status_code}")
        
        # 测试3: 检查Finnhub API实际返回的数据
        print(f"\n3. 检查Finnhub API实际返回的数据结构:")
        print("-" * 60)
        
        # 模拟Finnhub quote API调用
        import finnhub
        # 注意：这里只是说明，实际需要API key
        
        print("Finnhub quote API返回的字段通常包括:")
        print("  - c: current price")
        print("  - h: high price of the day")
        print("  - l: low price of the day")
        print("  - o: open price")
        print("  - pc: previous close price")
        print("  - t: timestamp")
        
        print(f"\n修复说明:")
        print("  修改了fetch_real_stock_data函数:")
        print("    dayHigh: quote_data.get('h') or quote_data.get('high') or None")
        print("    dayLow: quote_data.get('l') or quote_data.get('low') or None")
        
        print(f"\n  修改了fetch_stock_data_lightweight函数:")
        print("    添加了dayHigh和dayLow字段")
        
    except Exception as e:
        print(f"测试异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    test_fix_result()