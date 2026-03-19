#!/usr/bin/env python3
"""
验证最终修复
"""

import requests
import json
import time

def verify_final_fix():
    """验证最终修复"""
    print("验证Day Low/Day High最终修复")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 1. 调用API获取数据
        print("1. 调用API获取数据:")
        print("-" * 60)
        
        symbols = 'AAPL,MSFT,TSLA'
        response = requests.get(f"{base_url}/market/stocks?symbols={symbols}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"返回 {len(stocks)} 支股票")
            print(f"\n每支股票的dayHigh/dayLow字段:")
            print("-" * 60)
            
            for stock in stocks:
                symbol = stock.get('symbol', 'N/A')
                day_high = stock.get('dayHigh')
                day_low = stock.get('dayLow')
                high = stock.get('high')
                low = stock.get('low')
                h = stock.get('h')
                l = stock.get('l')
                
                print(f"{symbol}:")
                print(f"  dayHigh: {day_high} {'✅' if day_high is not None else '❌'}")
                print(f"  dayLow: {day_low} {'✅' if day_low is not None else '❌'}")
                print(f"  high: {high}")
                print(f"  low: {low}")
                print(f"  h: {h}")
                print(f"  l: {l}")
                
                # 检查是否应该显示
                if day_high is not None and day_high != 0:
                    print(f"  ✅ 前端应该显示: ${day_high:.2f}")
                else:
                    print(f"  ❌ 前端会显示: --")
                
                if day_low is not None and day_low != 0:
                    print(f"  ✅ 前端应该显示: ${day_low:.2f}")
                else:
                    print(f"  ❌ 前端会显示: --")
        
        # 2. 总结修复
        print(f"\n\n2. 修复总结:")
        print("-" * 60)
        
        print(f"后端代码修改:")
        print(f"  之前: 'dayHigh': quote_data.get('h') or quote_data.get('high') or None")
        print(f"  问题: 如果h=0，则0 or None or None = 0，前端显示'--'")
        print(f"  之后: 'dayHigh': quote_data.get('h') if quote_data.get('h') is not None else quote_data.get('high')")
        print(f"  效果: 即使h=0，也会传递0给前端")
        
        print(f"\n前端代码修改:")
        print(f"  之前: 只读取dayHigh/dayLow字段")
        print(f"  之后: 尝试多个字段: dayHigh || high || h")
        print(f"  效果: 兼容多种可能的字段名")
        
        print(f"\n前端render函数逻辑:")
        print(f"  if (value === null || value === 0) return '--'")
        print(f"  所以即使后端传递0，前端也会显示'--'")
        
        print(f"\n最终解决方案:")
        print(f"  1. 后端确保传递实际值（即使是0）")
        print(f"  2. 前端处理0值（可能显示'--'或'$0.00'）")
        print(f"  3. 或者修改前端逻辑，将0视为有效值")
        
    except Exception as e:
        print(f"验证异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    verify_final_fix()