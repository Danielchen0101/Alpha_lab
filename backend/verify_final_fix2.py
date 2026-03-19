#!/usr/bin/env python3
"""
验证最终修复
"""

import requests
import json
import time

def verify_final_fix2():
    """验证最终修复"""
    print("验证Day Low/Day High最终修复")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 1. 调用API获取数据
        print("1. 调用API获取数据:")
        print("-" * 60)
        
        symbols = 'AAPL,MSFT,TSLA,NVDA'
        response = requests.get(f"{base_url}/market/stocks?symbols={symbols}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"返回 {len(stocks)} 支股票")
            print(f"\n每支股票的关键字段:")
            print("-" * 60)
            
            for stock in stocks:
                symbol = stock.get('symbol', 'N/A')
                price = stock.get('price')
                day_high = stock.get('dayHigh')
                day_low = stock.get('dayLow')
                
                print(f"\n{symbol}:")
                print(f"  price: {price}")
                print(f"  dayHigh: {day_high}")
                print(f"  dayLow: {day_low}")
                
                # 检查三个值是否不同
                if price is not None and day_high is not None and day_low is not None:
                    if price == day_high == day_low:
                        print(f"  ❌ 三个值完全相同!")
                    elif price == day_high:
                        print(f"  ⚠️  price 和 dayHigh 相同!")
                    elif price == day_low:
                        print(f"  ⚠️  price 和 dayLow 相同!")
                    elif day_high == day_low:
                        print(f"  ⚠️  dayHigh 和 dayLow 相同!")
                    else:
                        print(f"  ✅ 三个值都不同")
                else:
                    print(f"  ⚠️  有字段为None")
                
                # 检查是否有真实数据
                if day_high is not None and day_high != 0:
                    print(f"  ✅ dayHigh有真实数据: ${day_high:.2f}")
                else:
                    print(f"  ❌ dayHigh无数据，前端会显示: --")
                    
                if day_low is not None and day_low != 0:
                    print(f"  ✅ dayLow有真实数据: ${day_low:.2f}")
                else:
                    print(f"  ❌ dayLow无数据，前端会显示: --")
        
        # 2. 检查后端日志
        print(f"\n\n2. 检查后端日志:")
        print("-" * 60)
        print("请查看后端控制台日志，确认:")
        print("  1. Finnhub API返回的h/l字段值")
        print("  2. 后端是否正确设置了dayHigh/dayLow字段")
        
        # 3. 预期结果
        print(f"\n\n3. 预期结果:")
        print("-" * 60)
        print("修复后应该:")
        print("  ✅ AAPL的Price/Day Low/Day High三个值应该不同")
        print("  ✅ Day Low应该显示当天最低价（如$249.00）")
        print("  ✅ Day High应该显示当天最高价（如$254.94）")
        print("  ✅ 不再显示和Price相同的值")
        print("  ✅ 如果没有真实数据，显示'--'")
        
    except Exception as e:
        print(f"验证异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    verify_final_fix2()