#!/usr/bin/env python3
"""
直接测试修复，查看后端日志
"""

import requests
import json
import time

def direct_test():
    """直接测试"""
    print("直接测试修复，查看转换日志")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    # 测试少量股票，以便查看日志
    test_symbols = ['TSM', 'AAPL', 'NVDA']
    
    for symbol in test_symbols:
        print(f"\n测试 {symbol}:")
        print("-" * 40)
        
        try:
            # 使用dashboard参数，触发修复逻辑
            timestamp = int(time.time() * 1000)
            url = f"{base_url}/market/stocks?symbols={symbol}&dashboard=true&_={timestamp}"
            
            response = requests.get(url, timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                stocks = data.get('stocks', [])
                
                if stocks:
                    stock = stocks[0]
                    print(f"  Symbol: {stock.get('symbol')}")
                    print(f"  Currency: {stock.get('currency', 'USD')}")
                    print(f"  Market Cap: {stock.get('marketCap')}")
                    
                    if stock.get('marketCap'):
                        cap = stock.get('marketCap')
                        cap_trillion = cap / 1_000_000_000_000
                        print(f"  显示: ${cap_trillion:.2f}T")
                        
                        # 检查是否应该被跳过
                        market_cap_raw = cap / 1000000 if cap else 0  # 反向计算原始值
                        if market_cap_raw > 10_000_000:
                            print(f"  [应该跳过] 原始值{market_cap_raw} > 10,000,000")
                        else:
                            print(f"  [正常转换] 原始值{market_cap_raw}在合理范围")
                    else:
                        print(f"  [已跳过] market cap为None")
                else:
                    print(f"  没有获取到数据")
            else:
                print(f"  请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"  测试异常: {str(e)}")
    
    print(f"\n" + "=" * 60)
    print(f"请查看后端控制台日志，确认是否有:")
    print(f"  [正常转换] 或 [跳过转换] 日志")
    print(f"  TSM应该显示 [跳过转换] TSM: 值过大(...)")
    print(f"  AAPL和NVDA应该显示 [正常转换]")

if __name__ == "__main__":
    direct_test()