#!/usr/bin/env python3
"""
触发调试
"""

import requests
import json

def trigger_debug():
    """触发调试"""
    print("触发API调用查看后端日志")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 触发API调用
        print("触发 /api/market/stocks?symbols=AAPL")
        response = requests.get(f"{base_url}/market/stocks?symbols=AAPL", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"API调用成功")
            
            # 打印返回的数据
            stocks = data.get('stocks', [])
            if stocks:
                stock = stocks[0]
                print(f"\nAAPL返回的数据:")
                for key, value in stock.items():
                    print(f"  {key}: {value}")
            
            print(f"\n请查看后端控制台日志，确认:")
            print(f"  1. Finnhub quote API返回的所有字段")
            print(f"  2. 是否有h/l字段")
            print(f"  3. h/l字段的值")
        else:
            print(f"API调用失败: {response.status_code}")
            
    except Exception as e:
        print(f"触发异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    trigger_debug()