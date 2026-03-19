#!/usr/bin/env python3
"""
最终验证USD-only修复
"""

import requests
import json
import time

def final_verification_usd():
    """最终验证"""
    print("最终验证USD-only修复")
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
            
            # 1. 分析所有股票
            print(f"\n1. 所有股票分析:")
            print("-" * 60)
            print(f"{'Symbol':<8} {'Currency':<10} {'MarketCap':<20} {'状态':<15}")
            print("-" * 60)
            
            for stock in stocks:
                symbol = stock.get('symbol', 'N/A')
                currency = stock.get('currency', 'USD')
                market_cap = stock.get('marketCap')
                
                status = "正常"
                if currency != 'USD':
                    status = "非USD"
                elif market_cap:
                    cap_trillion = market_cap / 1_000_000_000_000
                    if cap_trillion > 20:  # 大于20T异常
                        status = "异常(>20T)"
                    elif cap_trillion < 0.01:  # 小于10B异常
                        status = "异常(<10B)"
                
                if market_cap:
                    cap_trillion = market_cap / 1_000_000_000_000
                    print(f"{symbol:<8} {currency:<10} ${cap_trillion:<19.2f}T {status:<15}")
                else:
                    print(f"{symbol:<8} {currency:<10} {'N/A':<20} {status:<15}")
            
            # 2. 模拟前端计算逻辑
            print(f"\n2. 模拟前端计算逻辑:")
            print("-" * 60)
            
            MAX_REASONABLE_MARKET_CAP = 20_000_000_000_000  # 20T
            
            valid_stocks = []
            for stock in stocks:
                currency = stock.get('currency', 'USD')
                market_cap = stock.get('marketCap')
                
                # 前端过滤逻辑
                if currency != 'USD':
                    continue
                if market_cap is None:
                    continue
                if market_cap > MAX_REASONABLE_MARKET_CAP:
                    continue
                
                valid_stocks.append(stock)
            
            print(f"有效股票数量: {len(valid_stocks)}/{len(stocks)}")
            
            # 3. 计算Largest Cap（前端逻辑）
            print(f"\n3. Largest Cap计算（前端逻辑）:")
            print("-" * 60)
            
            if valid_stocks:
                # 按market cap排序
                sorted_stocks = sorted(valid_stocks, key=lambda x: x.get('marketCap', 0), reverse=True)
                
                print(f"有效股票排名:")
                for i, stock in enumerate(sorted_stocks[:5], 1):
                    cap = stock.get('marketCap', 0)
                    cap_trillion = cap / 1_000_000_000_000
                    print(f"  {i}. {stock.get('symbol')}: ${cap_trillion:.2f}T")
                
                largest = sorted_stocks[0]
                cap = largest.get('marketCap', 0)
                cap_trillion = cap / 1_000_000_000_000
                
                print(f"\nLargest Cap应该是: {largest.get('symbol')} ${cap_trillion:.2f}T")
                
                if largest.get('symbol') == 'TSM':
                    print(f"  ❌ Largest Cap仍然是TSM")
                else:
                    print(f"  ✅ Largest Cap是{largest.get('symbol')}")
            else:
                print(f"没有有效的股票")
            
            # 4. 计算Total Market Cap（前端逻辑）
            print(f"\n4. Total Market Cap计算（前端逻辑）:")
            print("-" * 60)
            
            total_cap = sum(s.get('marketCap', 0) for s in valid_stocks)
            total_cap_trillion = total_cap / 1_000_000_000_000
            
            print(f"参与计算的股票数量: {len(valid_stocks)}")
            print(f"Total Market Cap: ${total_cap_trillion:.2f}T")
            
            # 合理范围检查
            if total_cap_trillion < 20:
                print(f"  ✅ Total Market Cap在合理范围内")
            else:
                print(f"  ❌ Total Market Cap异常")
            
            # 5. 当前15支股票列表
            print(f"\n5. 当前15支股票列表:")
            symbols = [s.get('symbol') for s in stocks]
            print(f"  {', '.join(symbols)}")
            
            # 6. 总结
            print(f"\n6. 修复验证总结:")
            print("-" * 40)
            
            success = True
            
            # 检查TSM是否被排除
            tsm_in_valid = any(s.get('symbol') == 'TSM' for s in valid_stocks)
            if tsm_in_valid:
                print(f"  ❌ TSM仍然在有效股票中")
                success = False
            else:
                print(f"  ✅ TSM已被排除（值过大）")
            
            # 检查Largest Cap
            if valid_stocks and valid_stocks[0].get('symbol') == 'TSM':
                print(f"  ❌ Largest Cap仍然是TSM")
                success = False
            elif valid_stocks:
                print(f"  ✅ Largest Cap是{valid_stocks[0].get('symbol')}")
            else:
                print(f"  ⚠️  没有有效的股票")
            
            # 检查Total Market Cap
            if total_cap_trillion < 20:
                print(f"  ✅ Total Market Cap合理")
            else:
                print(f"  ❌ Total Market Cap异常")
                success = False
            
            if success:
                print(f"\n  🎉 [总体结果] USD-only修复成功!")
            else:
                print(f"\n  ❌ [总体结果] 修复仍有问题")
            
        else:
            print(f"请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"验证异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    final_verification_usd()