#!/usr/bin/env python3
"""
强制使用完整模式
"""

import requests
import json

def force_full_mode():
    """强制使用完整模式"""
    print("强制使用完整模式测试")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 测试1: 不带dashboard参数（应该使用完整模式）
        print("1. 不带dashboard参数（应该使用完整模式）:")
        print("-" * 60)
        
        symbols = 'AAPL'
        response = requests.get(f"{base_url}/market/stocks?symbols={symbols}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"响应状态: 成功")
            
            stocks = data.get('stocks', [])
            if stocks:
                stock = stocks[0]
                print(f"\nAAPL返回的字段:")
                for key, value in stock.items():
                    print(f"  {key}: {value}")
        
        # 测试2: 检查后端get_market_stocks函数逻辑
        print(f"\n\n2. 检查后端逻辑:")
        print("-" * 60)
        
        print("根据代码，get_market_stocks函数逻辑:")
        print("  1. 如果指定了symbols参数，使用原有逻辑")
        print("  2. 如果没有指定symbols，且dashboard=true，使用动态筛选")
        print("  3. 如果没有指定symbols，且dashboard=false，使用CANDIDATE_STOCKS[:15]")
        print("  4. 然后调用fetch_real_stock_data(symbol)获取完整数据")
        
        print(f"\n问题分析:")
        print("  Market页调用时指定了symbols参数，应该使用完整模式")
        print("  但dayHigh/dayLow字段仍然是None，说明:")
        print("    1. Finnhub API没有返回h/l字段")
        print("    2. 或者代码路径有问题")
        
    except Exception as e:
        print(f"测试异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    force_full_mode()