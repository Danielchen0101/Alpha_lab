#!/usr/bin/env python3
"""
获取真实数据
"""

import requests
import json

def get_real_data():
    """获取真实数据"""
    print("获取真实数据")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 调用API
        response = requests.get(f"{base_url}/market/stocks?symbols=AAPL", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"完整响应JSON:")
            print(json.dumps(data, indent=2))
            
            # 检查响应结构
            print(f"\n响应结构:")
            print(f"  success: {data.get('success')}")
            print(f"  stocks count: {len(data.get('stocks', []))}")
            
            stocks = data.get('stocks', [])
            if stocks:
                stock = stocks[0]
                print(f"\nAAPL股票字段列表:")
                fields = list(stock.keys())
                print(f"  字段数量: {len(fields)}")
                print(f"  字段列表: {fields}")
                
                # 检查是否有dayHigh/dayLow
                print(f"\n检查dayHigh/dayLow:")
                print(f"  'dayHigh' in fields: {'dayHigh' in fields}")
                print(f"  'dayLow' in fields: {'dayLow' in fields}")
                
                if 'dayHigh' in fields:
                    print(f"  dayHigh值: {stock.get('dayHigh')}")
                else:
                    print(f"  ❌ 没有dayHigh字段")
                    
                if 'dayLow' in fields:
                    print(f"  dayLow值: {stock.get('dayLow')}")
                else:
                    print(f"  ❌ 没有dayLow字段")
        
        else:
            print(f"API调用失败: {response.status_code}")
            
    except Exception as e:
        print(f"获取异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    get_real_data()