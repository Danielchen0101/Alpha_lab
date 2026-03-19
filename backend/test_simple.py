#!/usr/bin/env python3
"""
简单测试TSM修复
"""

import requests
import json

def test_simple():
    """简单测试"""
    print("简单测试TSM修复")
    print("=" * 60)
    
    # 测试单个股票
    symbols = ['TSM', 'AAPL']
    
    for symbol in symbols:
        print(f"\n测试 {symbol}:")
        print("-" * 40)
        
        try:
            response = requests.get(f"http://127.0.0.1:8889/api/market/stock/{symbol}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f"  Market Cap: {data.get('marketCap')}")
                
                if data.get('marketCap'):
                    cap = data.get('marketCap')
                    cap_trillion = cap / 1_000_000_000_000
                    print(f"  显示: ${cap_trillion:.2f}T")
                    
                    if symbol == 'TSM':
                        if cap_trillion > 10:
                            print(f"  [ERROR] TSM ${cap_trillion:.2f}T 仍然错误!")
                        else:
                            print(f"  [SUCCESS] TSM ${cap_trillion:.2f}T 已修复")
                    else:
                        if 0.1 < cap_trillion < 10:
                            print(f"  [OK] {symbol} ${cap_trillion:.2f}T 正常")
                        else:
                            print(f"  [WARNING] {symbol} ${cap_trillion:.2f}T 异常")
                else:
                    print(f"  [INFO] {symbol} market cap为None")
            else:
                print(f"  请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"  测试异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    test_simple()