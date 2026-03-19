#!/usr/bin/env python3
"""
最终检查所有可能的情况
"""

import requests
import json
import time

def final_check_all():
    """最终检查"""
    print("最终检查Day Low/Day High问题")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 1. 直接调用API获取真实数据
        print("1. 直接调用API获取真实数据:")
        print("-" * 80)
        
        symbols = 'AAPL'
        response = requests.get(f"{base_url}/market/stocks?symbols={symbols}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"完整响应:")
            print(json.dumps(data, indent=2))
            
            stocks = data.get('stocks', [])
            if stocks:
                stock = stocks[0]
                
                print(f"\nAAPL股票的所有字段:")
                all_fields = list(stock.keys())
                print(f"  字段列表: {all_fields}")
                
                # 检查所有可能的字段
                print(f"\n检查所有可能的high/low字段:")
                possible_fields = ['dayHigh', 'dayLow', 'high', 'low', 'h', 'l']
                for field in possible_fields:
                    if field in stock:
                        value = stock[field]
                        status = "✅" if value is not None and value != 0 else "❌ (null或0)"
                        print(f"  {field}: {value} {status}")
                    else:
                        print(f"  {field}: ❌ 不存在")
        
        # 2. 分析问题
        print(f"\n\n2. 问题分析:")
        print("-" * 80)
        
        print(f"可能的情况:")
        print(f"  情况1: Finnhub API没有返回h/l字段")
        print(f"  情况2: 返回的h/l字段值为0或null")
        print(f"  情况3: 后端没有正确设置dayHigh/dayLow字段")
        print(f"  情况4: 后端设置了字段，但值为0")
        
        print(f"\n解决方案:")
        print(f"  方案A: 确保后端正确设置dayHigh和dayLow字段")
        print(f"  方案B: 如果值为0，使用其他逻辑（如使用price作为fallback）")
        print(f"  方案C: 前端直接读取high/low字段，而不是dayHigh/dayLow")
        
        # 3. 检查后端代码
        print(f"\n\n3. 后端代码检查:")
        print("-" * 80)
        
        print(f"fetch_real_stock_data函数中的相关代码:")
        print(f"  'dayHigh': quote_data.get('h') or quote_data.get('high') or None,")
        print(f"  'dayLow': quote_data.get('l') or quote_data.get('low') or None,")
        
        print(f"\n问题:")
        print(f"  如果quote_data.get('h')返回0，那么0 or None or None = 0")
        print(f"  前端收到0，会显示'--'（因为0被视为无效值）")
        
        print(f"\n修复建议:")
        print(f"  将代码改为:")
        print(f"  'dayHigh': quote_data.get('h') or quote_data.get('high'),")
        print(f"  'dayLow': quote_data.get('l') or quote_data.get('low'),")
        print(f"  这样即使值为0，也会传递给前端")
        
    except Exception as e:
        print(f"检查异常: {str(e)}")
    
    print(f"\n" + "=" * 80)

if __name__ == "__main__":
    final_check_all()