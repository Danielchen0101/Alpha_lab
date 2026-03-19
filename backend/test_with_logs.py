#!/usr/bin/env python3
"""
测试并查看后端日志
"""

import requests
import json
import time

def test_with_logs():
    """测试并触发后端日志"""
    print("测试Dashboard API，触发后端日志")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 测试单个股票，以便查看日志
        test_symbols = ['TSM', 'AAPL']
        
        for symbol in test_symbols:
            print(f"\n测试 {symbol}:")
            print("-" * 40)
            
            # 使用dashboard参数
            timestamp = int(time.time() * 1000)
            url = f"{base_url}/market/stocks?symbols={symbol}&dashboard=true&_={timestamp}"
            
            print(f"请求URL: {url}")
            response = requests.get(url, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                stocks = data.get('stocks', [])
                
                if stocks:
                    stock = stocks[0]
                    print(f"  返回数据:")
                    print(f"    Symbol: {stock.get('symbol')}")
                    print(f"    Currency: {stock.get('currency', 'USD')}")
                    print(f"    Market Cap: {stock.get('marketCap')}")
                    
                    if stock.get('marketCap'):
                        cap = stock.get('marketCap')
                        cap_trillion = cap / 1_000_000_000_000
                        print(f"    显示: ${cap_trillion:.2f}T")
                    else:
                        print(f"    [正确] market cap为None")
                else:
                    print(f"  没有获取到数据")
            else:
                print(f"  请求失败: {response.status_code}")
                
        print(f"\n" + "=" * 60)
        print(f"请查看后端控制台日志，确认是否有:")
        print(f"  对于TSM: [跳过转换] TSM: 值过大(48493818.83)")
        print(f"  对于AAPL: [正常转换] AAPL: ...")
        
    except Exception as e:
        print(f"测试异常: {str(e)}")

if __name__ == "__main__":
    test_with_logs()