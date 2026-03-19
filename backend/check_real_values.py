#!/usr/bin/env python3
"""
检查真实字段值
"""

import requests
import json
import time

def check_real_values():
    """检查真实字段值"""
    print("检查真实字段值")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 调用API获取真实数据
        print("调用 /api/market/stocks 获取真实数据:")
        print("-" * 80)
        
        symbols = 'AAPL,MSFT,TSLA,NVDA'
        response = requests.get(f"{base_url}/market/stocks?symbols={symbols}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"返回 {len(stocks)} 支股票")
            print(f"\n详细字段值检查:")
            print("-" * 80)
            
            for stock in stocks:
                symbol = stock.get('symbol', 'N/A')
                
                print(f"\n{symbol}:")
                print(f"  price: {stock.get('price')}")
                print(f"  high: {stock.get('high')}")
                print(f"  low: {stock.get('low')}")
                print(f"  h: {stock.get('h')}")
                print(f"  l: {stock.get('l')}")
                print(f"  dayHigh: {stock.get('dayHigh')}")
                print(f"  dayLow: {stock.get('dayLow')}")
                
                # 检查是否所有值都一样
                price = stock.get('price')
                day_high = stock.get('dayHigh')
                day_low = stock.get('dayLow')
                
                if price == day_high == day_low:
                    print(f"  ⚠️  警告: price, dayHigh, dayLow 三个值完全相同!")
                elif price == day_high:
                    print(f"  ⚠️  警告: price 和 dayHigh 相同!")
                elif price == day_low:
                    print(f"  ⚠️  警告: price 和 dayLow 相同!")
                elif day_high == day_low:
                    print(f"  ⚠️  警告: dayHigh 和 dayLow 相同!")
                else:
                    print(f"  ✅ 正常: 三个值都不同")
                
                # 检查是否有真实的高低价数据
                has_real_high_low = (
                    (stock.get('high') is not None and stock.get('high') != 0) or
                    (stock.get('low') is not None and stock.get('low') != 0) or
                    (stock.get('h') is not None and stock.get('h') != 0) or
                    (stock.get('l') is not None and stock.get('l') != 0)
                )
                
                if has_real_high_low:
                    print(f"  ✅ 有真实的high/low数据")
                else:
                    print(f"  ❌ 没有真实的high/low数据")
        
        # 检查后端日志中的Finnhub API原始数据
        print(f"\n\n检查后端日志中的Finnhub API原始数据:")
        print("-" * 80)
        print("需要查看后端控制台日志，确认:")
        print("  1. Finnhub quote API返回的原始数据")
        print("  2. 是否有h/l字段")
        print("  3. h/l字段的值是多少")
        
    except Exception as e:
        print(f"检查异常: {str(e)}")
    
    print(f"\n" + "=" * 80)

if __name__ == "__main__":
    check_real_values()