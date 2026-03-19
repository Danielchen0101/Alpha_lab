#!/usr/bin/env python3
"""
检查当前返回的数据
"""

import requests
import json

def check_current_return():
    """检查当前返回的数据"""
    print("检查 /api/market/stocks 当前返回数据")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 调用API获取数据
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
                for key, value in stock.items():
                    print(f"  '{key}': {value}")
                
                # 检查是否有dayHigh/dayLow字段
                print(f"\n检查dayHigh/dayLow字段:")
                if 'dayHigh' in stock:
                    print(f"  ✅ 有'dayHigh'字段: {stock['dayHigh']}")
                else:
                    print(f"  ❌ 没有'dayHigh'字段")
                    
                if 'dayLow' in stock:
                    print(f"  ✅ 有'dayLow'字段: {stock['dayLow']}")
                else:
                    print(f"  ❌ 没有'dayLow'字段")
        
        else:
            print(f"API调用失败: {response.status_code}")
            
    except Exception as e:
        print(f"检查异常: {str(e)}")
    
    print(f"\n" + "=" * 80)

if __name__ == "__main__":
    check_current_return()