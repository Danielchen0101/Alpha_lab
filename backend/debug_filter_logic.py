#!/usr/bin/env python3
"""
调试前端过滤逻辑
"""

import requests
import json
import time

def debug_filter_logic():
    """调试过滤逻辑"""
    print("调试前端过滤逻辑")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 获取Dashboard数据
        timestamp = int(time.time() * 1000)
        response = requests.get(f"{base_url}/market/stocks?dashboard=true&_={timestamp}", timeout=20)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"获取到 {len(stocks)} 支股票")
            print(f"\n模拟前端过滤逻辑:")
            print("-" * 80)
            print(f"{'Symbol':<8} {'Currency':<10} {'MarketCap原始值':<25} {'safeNumber':<15} {'过滤结果':<15} {'原因':<20}")
            print("-" * 80)
            
            MAX_REASONABLE_MARKET_CAP = 20_000_000_000_000  # 20T
            
            filtered_out_count = 0
            passed_count = 0
            
            for stock in stocks:
                symbol = stock.get('symbol', 'N/A')
                currency = stock.get('currency', 'USD')
                market_cap_raw = stock.get('marketCap')
                
                # 模拟safeNumber函数（假设就是原值）
                safe_number = market_cap_raw if market_cap_raw is not None else 0
                
                # 应用过滤逻辑
                filtered = False
                reason = ""
                
                # 检查1: currency !== 'USD'
                if currency != 'USD':
                    filtered = True
                    reason = "currency != 'USD'"
                
                # 检查2: marketCap === null || marketCap === undefined
                elif market_cap_raw is None:
                    filtered = True
                    reason = "marketCap is null/undefined"
                
                # 检查3: marketCap > MAX_REASONABLE_MARKET_CAP
                elif market_cap_raw > MAX_REASONABLE_MARKET_CAP:
                    filtered = True
                    reason = f"> 20T ({market_cap_raw/1_000_000_000_000:.2f}T)"
                
                else:
                    passed_count += 1
                    reason = "通过"
                
                if filtered:
                    filtered_out_count += 1
                
                # 显示结果
                if market_cap_raw:
                    cap_trillion = market_cap_raw / 1_000_000_000_000
                    print(f"{symbol:<8} {currency:<10} {market_cap_raw:<25} {safe_number:<15} {'过滤' if filtered else '通过':<15} {reason:<20}")
                else:
                    print(f"{symbol:<8} {currency:<10} {'null/undefined':<25} {0:<15} {'过滤' if filtered else '通过':<15} {reason:<20}")
            
            # 分析结果
            print(f"\n过滤结果分析:")
            print("-" * 80)
            print(f"总股票数: {len(stocks)}")
            print(f"通过过滤: {passed_count}")
            print(f"被过滤: {filtered_out_count}")
            
            if passed_count == 0:
                print(f"\n❌ 问题: 所有股票都被过滤掉了!")
                print(f"可能的原因:")
                print(f"1. 所有股票的currency都不等于'USD'")
                print(f"2. 所有股票的marketCap都是null/undefined")
                print(f"3. 所有股票的marketCap都大于20T")
                
                # 检查具体原因
                print(f"\n详细分析:")
                usd_count = len([s for s in stocks if s.get('currency') == 'USD'])
                market_cap_count = len([s for s in stocks if s.get('marketCap') is not None])
                excessive_count = len([s for s in stocks if s.get('marketCap', 0) > MAX_REASONABLE_MARKET_CAP])
                
                print(f"  USD货币股票: {usd_count}/{len(stocks)}")
                print(f"  有marketCap的股票: {market_cap_count}/{len(stocks)}")
                print(f"  marketCap > 20T的股票: {excessive_count}/{len(stocks)}")
                
                # 检查前5支股票的详细数据
                print(f"\n前5支股票详细数据:")
                for i, stock in enumerate(stocks[:5], 1):
                    symbol = stock.get('symbol', 'N/A')
                    currency = stock.get('currency', 'USD')
                    market_cap = stock.get('marketCap')
                    
                    print(f"  {i}. {symbol}:")
                    print(f"     currency: {currency} (是否为USD: {currency == 'USD'})")
                    print(f"     marketCap: {market_cap}")
                    if market_cap:
                        cap_trillion = market_cap / 1_000_000_000_000
                        print(f"     转换为: ${cap_trillion:.2f}T")
                        print(f"     是否>20T: {market_cap > MAX_REASONABLE_MARKET_CAP}")
            
            else:
                print(f"\n✅ 有 {passed_count} 支股票通过过滤")
                
                # 显示通过过滤的股票
                print(f"\n通过过滤的股票:")
                for stock in stocks:
                    symbol = stock.get('symbol', 'N/A')
                    currency = stock.get('currency', 'USD')
                    market_cap = stock.get('marketCap')
                    
                    if (currency == 'USD' and 
                        market_cap is not None and 
                        market_cap <= MAX_REASONABLE_MARKET_CAP):
                        
                        cap_trillion = market_cap / 1_000_000_000_000
                        print(f"  {symbol}: ${cap_trillion:.2f}T")
            
        else:
            print(f"请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"调试异常: {str(e)}")
    
    print(f"\n" + "=" * 80)

if __name__ == "__main__":
    debug_filter_logic()