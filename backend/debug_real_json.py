#!/usr/bin/env python3
"""
调试真实返回的JSON数据
"""

import requests
import json
import time

def debug_real_json():
    """调试真实JSON"""
    print("调试 /api/market/stocks 真实返回数据")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 测试1: 普通Market页调用（不带dashboard）
        print("1. 普通Market页调用（不带dashboard参数）:")
        print("-" * 80)
        
        symbols = 'AAPL'
        response = requests.get(f"{base_url}/market/stocks?symbols={symbols}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"完整响应JSON:")
            print(json.dumps(data, indent=2))
            
            stocks = data.get('stocks', [])
            if stocks:
                stock = stocks[0]
                print(f"\n第一支股票（AAPL）的所有字段:")
                for key, value in stock.items():
                    print(f"  '{key}': {value} (类型: {type(value).__name__})")
                
                # 特别检查high/low相关字段
                print(f"\n特别检查high/low相关字段:")
                check_fields = ['high', 'low', 'dayHigh', 'dayLow', 'h', 'l']
                for field in check_fields:
                    if field in stock:
                        print(f"  ✅ '{field}': {stock[field]}")
                    else:
                        print(f"  ❌ '{field}': 不存在")
        
        # 测试2: Dashboard模式调用
        print(f"\n\n2. Dashboard模式调用（带dashboard=true）:")
        print("-" * 80)
        
        timestamp = int(time.time() * 1000)
        response = requests.get(f"{base_url}/market/stocks?dashboard=true&_={timestamp}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            if stocks:
                stock = stocks[0]
                print(f"第一支股票的所有字段（Dashboard模式）:")
                for key, value in stock.items():
                    print(f"  '{key}': {value}")
                
                # 检查high/low相关字段
                print(f"\n检查high/low相关字段:")
                check_fields = ['high', 'low', 'dayHigh', 'dayLow', 'h', 'l']
                for field in check_fields:
                    if field in stock:
                        print(f"  ✅ '{field}': {stock[field]}")
                    else:
                        print(f"  ❌ '{field}': 不存在")
        
        # 测试3: 检查后端实际从Finnhub API获取的数据
        print(f"\n\n3. 检查后端日志中的Finnhub API原始数据:")
        print("-" * 80)
        print("需要查看后端控制台日志，确认:")
        print("  1. Finnhub quote API返回的原始数据")
        print("  2. 是否有'h'或'high'字段")
        print("  3. 是否有'l'或'low'字段")
        
    except Exception as e:
        print(f"调试异常: {str(e)}")
    
    print(f"\n" + "=" * 80)

if __name__ == "__main__":
    debug_real_json()