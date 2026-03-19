#!/usr/bin/env python3
"""
检查Market页API返回的真实字段
"""

import requests
import json
import time

def check_market_fields():
    """检查Market页字段"""
    print("检查Market页API返回的真实字段")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 测试1: 获取单支股票数据（普通模式，非Dashboard）
        print("1. 测试单支股票（普通模式）:")
        print("-" * 80)
        
        symbol = 'AAPL'
        response = requests.get(f"{base_url}/market/stocks?symbols={symbol}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            if stocks:
                stock = stocks[0]
                print(f"股票: {stock.get('symbol')}")
                print(f"所有字段:")
                for key, value in stock.items():
                    print(f"  {key}: {value}")
                
                # 特别检查high/low相关字段
                print(f"\n特别检查high/low相关字段:")
                high_low_fields = ['high', 'low', 'dayHigh', 'dayLow', 'h', 'l', 'dayHigh', 'dayLow']
                for field in high_low_fields:
                    if field in stock:
                        print(f"  {field}: {stock[field]}")
                    else:
                        print(f"  {field}: 不存在")
            else:
                print(f"没有获取到股票数据")
        else:
            print(f"请求失败: {response.status_code}")
        
        # 测试2: 获取多支股票数据（Dashboard模式）
        print(f"\n2. 测试多支股票（Dashboard模式）:")
        print("-" * 80)
        
        timestamp = int(time.time() * 1000)
        response = requests.get(f"{base_url}/market/stocks?dashboard=true&_={timestamp}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            if stocks:
                # 检查第一支股票
                stock = stocks[0]
                print(f"股票: {stock.get('symbol')} (Dashboard模式)")
                print(f"字段数量: {len(stock.keys())}")
                
                # 检查high/low相关字段
                print(f"\nhigh/low相关字段:")
                for key in ['high', 'low', 'dayHigh', 'dayLow', 'h', 'l']:
                    if key in stock:
                        print(f"  {key}: {stock[key]}")
                    else:
                        print(f"  {key}: 不存在")
                
                # 检查其他重要字段
                print(f"\n其他重要字段:")
                for key in ['price', 'change', 'changePercent', 'volume', 'marketCap', 'currency', 'sector']:
                    if key in stock:
                        print(f"  {key}: {stock[key]}")
            else:
                print(f"没有获取到股票数据")
        else:
            print(f"请求失败: {response.status_code}")
        
        # 测试3: 检查后端不同函数返回的字段差异
        print(f"\n3. 检查后端函数差异:")
        print("-" * 80)
        
        # 检查fetch_real_stock_data函数（普通模式使用）
        print("fetch_real_stock_data函数应该包含:")
        print("  - dayHigh, dayLow (从quote_data.get('h'), quote_data.get('l'))")
        print("  - yearHigh, yearLow (从metrics.get('52WeekHigh'), metrics.get('52WeekLow'))")
        
        # 检查fetch_stock_data_lightweight函数（Dashboard模式使用）
        print("\nfetch_stock_data_lightweight函数应该包含:")
        print("  - 可能没有dayHigh/dayLow，因为轻量模式只获取核心字段")
        
    except Exception as e:
        print(f"检查异常: {str(e)}")
    
    print(f"\n" + "=" * 80)

if __name__ == "__main__":
    check_market_fields()