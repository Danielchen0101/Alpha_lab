#!/usr/bin/env python3
"""
简单修复测试
"""

import requests
import json

def test_simple_fix():
    """简单修复测试"""
    print("简单修复测试")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 测试指定symbols参数（应该使用完整模式）
        print("测试指定symbols参数（完整模式）:")
        print("-" * 60)
        
        response = requests.get(f"{base_url}/market/stocks?symbols=AAPL,MSFT", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"响应中的stocks数量: {len(data.get('stocks', []))}")
            
            stocks = data.get('stocks', [])
            for i, stock in enumerate(stocks[:2]):  # 只看前2支
                symbol = stock.get('symbol', 'N/A')
                print(f"\n{symbol}的字段:")
                for key in sorted(stock.keys()):
                    print(f"  {key}: {stock[key]}")
                
                # 检查是否有dayHigh/dayLow
                has_day_high = 'dayHigh' in stock
                has_day_low = 'dayLow' in stock
                
                print(f"  有dayHigh字段: {has_day_high}")
                print(f"  有dayLow字段: {has_day_low}")
                
                if has_day_high:
                    print(f"  dayHigh值: {stock.get('dayHigh')}")
                if has_day_low:
                    print(f"  dayLow值: {stock.get('dayLow')}")
        
        else:
            print(f"API调用失败: {response.status_code}")
            
    except Exception as e:
        print(f"测试异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    test_simple_fix()