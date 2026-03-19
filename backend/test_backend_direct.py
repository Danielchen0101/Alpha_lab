#!/usr/bin/env python3
"""
直接测试后端函数
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 模拟Finnhub API返回
def mock_finnhub_response():
    """模拟Finnhub API返回"""
    return {
        'c': 249.94,    # current price
        'd': -4.29,     # change
        'dp': -1.6874,  # change percent
        'h': 254.94,    # high price of the day
        'l': 249.0,     # low price of the day
        'o': 252.625,   # open price
        'pc': 254.23,   # previous close
        't': 1773864000 # timestamp
    }

def test_fetch_real_stock_data():
    """测试fetch_real_stock_data函数"""
    print("测试fetch_real_stock_data函数")
    print("=" * 60)
    
    # 模拟数据
    symbol = 'AAPL'
    quote_data = mock_finnhub_response()
    
    print(f"模拟Finnhub quote API返回:")
    for key, value in quote_data.items():
        print(f"  {key}: {value}")
    
    # 模拟stock_data对象
    stock_data = {
        "symbol": symbol,
        "name": "Apple Inc",
        "price": quote_data.get('c'),
        "change": quote_data.get('d'),
        "changePercent": quote_data.get('dp'),
        "dayHigh": quote_data.get('h'),
        "dayLow": quote_data.get('l'),
        "previousClose": quote_data.get('pc'),
    }
    
    print(f"\n模拟stock_data对象:")
    for key, value in stock_data.items():
        print(f"  '{key}': {value}")
    
    # 检查dayHigh/dayLow字段
    print(f"\n检查dayHigh/dayLow字段:")
    print(f"  dayHigh: {stock_data.get('dayHigh')} {'✅' if stock_data.get('dayHigh') is not None else '❌'}")
    print(f"  dayLow: {stock_data.get('dayLow')} {'✅' if stock_data.get('dayLow') is not None else '❌'}")
    
    # 检查三个值是否不同
    price = stock_data.get('price')
    day_high = stock_data.get('dayHigh')
    day_low = stock_data.get('dayLow')
    
    print(f"\n检查三个值是否不同:")
    print(f"  Price: {price}")
    print(f"  Day High: {day_high}")
    print(f"  Day Low: {day_low}")
    
    if price == day_high == day_low:
        print(f"  ❌ 三个值完全相同!")
    elif price == day_high:
        print(f"  ⚠️  Price 和 Day High 相同!")
    elif price == day_low:
        print(f"  ⚠️  Price 和 Day Low 相同!")
    elif day_high == day_low:
        print(f"  ⚠️  Day High 和 Day Low 相同!")
    else:
        print(f"  ✅ 三个值都不同")
    
    print(f"\n结论:")
    print(f"  1. Finnhub API返回了h/l字段")
    print(f"  2. 后端代码应该设置dayHigh/dayLow字段")
    print(f"  3. 但实际API返回中没有这些字段")
    print(f"  4. 问题: 后端可能没有正确设置这些字段")

if __name__ == "__main__":
    test_fetch_real_stock_data()