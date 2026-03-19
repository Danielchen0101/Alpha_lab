#!/usr/bin/env python3
"""
测试TSM market cap修复
"""

import requests
import json

def test_fix():
    """测试修复"""
    print("测试TSM market cap修复")
    print("=" * 60)
    
    # 测试单个API调用
    response = requests.get("http://127.0.0.1:8889/api/market/stock/TSM", timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        print(f"TSM数据:")
        print(f"  Symbol: {data.get('symbol')}")
        print(f"  Name: {data.get('name')}")
        print(f"  Price: ${data.get('price')}")
        print(f"  Market Cap: {data.get('marketCap')}")
        
        if data.get('marketCap'):
            market_cap_trillion = data.get('marketCap') / 1_000_000_000_000
            print(f"  Market Cap显示: ${market_cap_trillion:.2f}T")
            
            if 0.5 < market_cap_trillion < 0.7:
                print(f"  [SUCCESS] 修复成功! TSM市值${market_cap_trillion:.2f}T在合理范围内")
            else:
                print(f"  [FAILED] 修复失败! TSM市值${market_cap_trillion:.2f}T仍然异常")
        else:
            print(f"  [INFO] TSM market cap为None (可能是我们故意跳过的)")
    
    # 测试Dashboard数据
    print(f"\n测试Dashboard数据:")
    response2 = requests.get("http://127.0.0.1:8889/api/market/stocks?dashboard=true", timeout=15)
    
    if response2.status_code == 200:
        data2 = response2.json()
        stocks = data2.get('stocks', [])
        
        tsm_stock = next((s for s in stocks if s.get('symbol') == 'TSM'), None)
        if tsm_stock:
            print(f"  TSM在Dashboard数据中:")
            print(f"    Market Cap: {tsm_stock.get('marketCap')}")
            
            if tsm_stock.get('marketCap'):
                market_cap_trillion = tsm_stock.get('marketCap') / 1_000_000_000_000
                print(f"    Market Cap显示: ${market_cap_trillion:.2f}T")
                
                # 检查Largest Cap
                stocks_with_cap = [s for s in stocks if s.get('marketCap')]
                if stocks_with_cap:
                    largest_cap_stock = max(stocks_with_cap, key=lambda x: x.get('marketCap', 0))
                    largest_cap_value = largest_cap_stock.get('marketCap', 0)
                    largest_cap_trillion = largest_cap_value / 1_000_000_000_000
                    
                    print(f"\n  Largest Cap分析:")
                    print(f"    最大市值股票: {largest_cap_stock.get('symbol')}")
                    print(f"    市值: ${largest_cap_trillion:.2f}T")
                    
                    if largest_cap_stock.get('symbol') == 'TSM' and largest_cap_trillion > 10:
                        print(f"    [PROBLEM] Largest Cap仍然是TSM ${largest_cap_trillion:.2f}T，修复未生效")
                    elif largest_cap_stock.get('symbol') == 'NVDA':
                        print(f"    [SUCCESS] Largest Cap现在是NVDA ${largest_cap_trillion:.2f}T，修复成功")
                    else:
                        print(f"    [INFO] Largest Cap是{largest_cap_stock.get('symbol')} ${largest_cap_trillion:.2f}T")

if __name__ == "__main__":
    test_fix()