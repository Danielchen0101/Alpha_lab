#!/usr/bin/env python3
"""
检查当前15支股票的currency情况
"""

import requests
import json
import time

def check_currencies():
    """检查currency"""
    print("检查当前15支股票的currency")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 获取Dashboard数据
        timestamp = int(time.time() * 1000)
        response = requests.get(f"{base_url}/market/stocks?dashboard=true&_={timestamp}", timeout=20)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"获取到 {len(stocks)} 支股票")
            print(f"\nCurrency分布:")
            print("-" * 60)
            
            usd_stocks = []
            non_usd_stocks = []
            
            for stock in stocks:
                symbol = stock.get('symbol', 'N/A')
                currency = stock.get('currency', 'USD')
                market_cap = stock.get('marketCap')
                
                if currency == 'USD':
                    usd_stocks.append((symbol, market_cap))
                else:
                    non_usd_stocks.append((symbol, currency))
                
                # 显示详细信息
                if market_cap:
                    cap_trillion = market_cap / 1_000_000_000_000
                    print(f"{symbol:<8} {currency:<10} ${cap_trillion:<10.2f}T")
                else:
                    print(f"{symbol:<8} {currency:<10} N/A")
            
            # 统计结果
            print(f"\n统计结果:")
            print("-" * 60)
            print(f"USD货币股票: {len(usd_stocks)}支")
            print(f"非USD货币股票: {len(non_usd_stocks)}支")
            
            if non_usd_stocks:
                print(f"非USD股票列表:")
                for symbol, currency in non_usd_stocks:
                    print(f"  {symbol}: {currency}")
            
            # 检查USD股票中market cap最大的
            print(f"\nUSD股票中market cap排名:")
            print("-" * 60)
            
            # 过滤出有market cap的USD股票
            usd_with_cap = [(s, cap) for s, cap in usd_stocks if cap]
            
            if usd_with_cap:
                # 按market cap排序
                usd_with_cap.sort(key=lambda x: x[1], reverse=True)
                
                for i, (symbol, cap) in enumerate(usd_with_cap[:5], 1):
                    cap_trillion = cap / 1_000_000_000_000
                    print(f"{i}. {symbol}: ${cap_trillion:.2f}T")
                
                if usd_with_cap:
                    largest_symbol, largest_cap = usd_with_cap[0]
                    cap_trillion = largest_cap / 1_000_000_000_000
                    print(f"\nUSD股票中Largest Cap: {largest_symbol} ${cap_trillion:.2f}T")
            else:
                print(f"没有USD股票有有效的market cap")
            
        else:
            print(f"请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"检查异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    check_currencies()