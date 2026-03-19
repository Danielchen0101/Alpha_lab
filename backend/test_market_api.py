#!/usr/bin/env python3
"""
测试Market页API调用
"""

import requests
import json
import time

def test_market_api():
    """测试Market页API"""
    print("测试Market页API调用")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 测试1: Market页默认调用（不带dashboard参数）
        print("1. Market页默认调用（不带dashboard参数）:")
        print("-" * 60)
        
        symbols = 'AAPL,MSFT,GOOGL'
        response = requests.get(f"{base_url}/market/stocks?symbols={symbols}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            if stocks:
                print(f"返回 {len(stocks)} 支股票")
                print(f"第一支股票字段:")
                
                stock = stocks[0]
                for key, value in stock.items():
                    print(f"  {key}: {value}")
                
                # 检查是否有dayHigh/dayLow
                print(f"\n检查dayHigh/dayLow:")
                print(f"  'dayHigh' in stock: {'dayHigh' in stock}")
                print(f"  'dayLow' in stock: {'dayLow' in stock}")
                
                if 'dayHigh' in stock:
                    print(f"  dayHigh值: {stock['dayHigh']}")
                if 'dayLow' in stock:
                    print(f"  dayLow值: {stock['dayLow']}")
            else:
                print(f"没有返回股票数据")
        else:
            print(f"请求失败: {response.status_code}")
        
        # 测试2: 检查后端get_market_stocks函数逻辑
        print(f"\n2. 检查后端逻辑:")
        print("-" * 60)
        
        print("Market页调用流程:")
        print("  1. 前端调用 /market/stocks?symbols=... (不带dashboard参数)")
        print("  2. 后端get_market_stocks()函数处理")
        print("  3. 如果有symbols参数，使用原有逻辑")
        print("  4. 如果没有symbols参数，使用CANDIDATE_STOCKS[:15]")
        print("  5. 调用fetch_real_stock_data(symbol) 获取完整数据")
        
        print(f"\n关键问题:")
        print("  fetch_real_stock_data函数应该包含dayHigh/dayLow")
        print("  但实际返回的数据中没有这些字段")
        
    except Exception as e:
        print(f"测试异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    test_market_api()