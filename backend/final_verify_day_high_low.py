#!/usr/bin/env python3
"""
最终验证Day Low/Day High修复
"""

import requests
import json
import time

def final_verify():
    """最终验证"""
    print("最终验证Day Low/Day High修复")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 测试普通Market页调用
        print("1. 测试普通Market页API:")
        print("-" * 60)
        
        symbols = 'AAPL,MSFT,TSLA,NVDA'
        response = requests.get(f"{base_url}/market/stocks?symbols={symbols}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"返回 {len(stocks)} 支股票")
            print(f"\n每支股票的dayHigh/dayLow字段:")
            print("-" * 60)
            
            all_have_fields = True
            for stock in stocks:
                symbol = stock.get('symbol', 'N/A')
                day_high = stock.get('dayHigh')
                day_low = stock.get('dayLow')
                
                print(f"{symbol}:")
                print(f"  dayHigh: {day_high} {'✅' if day_high is not None and day_high != 0 else '❌'}")
                print(f"  dayLow: {day_low} {'✅' if day_low is not None and day_low != 0 else '❌'}")
                
                if day_high is None or day_high == 0 or day_low is None or day_low == 0:
                    all_have_fields = False
            
            if all_have_fields:
                print(f"\n✅ 所有股票都有有效的dayHigh和dayLow字段")
            else:
                print(f"\n❌ 有些股票的dayHigh/dayLow字段无效或为0")
                
                # 检查可能的原因
                print(f"\n可能的原因:")
                print(f"  1. Finnhub API没有返回h/l字段")
                print(f"  2. 字段名可能是'high'/'low'而不是'h'/'l'")
                print(f"  3. 值为0或null")
        
        else:
            print(f"请求失败: {response.status_code}")
        
        # 测试API返回的完整数据结构
        print(f"\n2. API返回的完整数据结构样例（AAPL）:")
        print("-" * 60)
        
        if stocks:
            aapl = next((s for s in stocks if s.get('symbol') == 'AAPL'), None)
            if aapl:
                print(f"AAPL的所有字段:")
                for key, value in aapl.items():
                    print(f"  {key}: {value}")
        
        # 总结
        print(f"\n3. 修复总结:")
        print("-" * 60)
        
        print(f"修改的后端代码:")
        print(f"  1. fetch_real_stock_data函数:")
        print(f"     dayHigh: quote_data.get('h') or quote_data.get('high') or None")
        print(f"     dayLow: quote_data.get('l') or quote_data.get('low') or None")
        
        print(f"\n  2. fetch_stock_data_lightweight函数:")
        print(f"     添加了dayHigh和dayLow字段")
        
        print(f"\n前端表格读取的字段名:")
        print(f"  - dataIndex: 'dayHigh'")
        print(f"  - dataIndex: 'dayLow'")
        
        print(f"\n预期结果:")
        print(f"  - Market页的Day Low和Day High列应该正常显示")
        print(f"  - 不再显示'--'")
        print(f"  - 显示实际的价格值（如$250.12）")
        
    except Exception as e:
        print(f"验证异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    final_verify()