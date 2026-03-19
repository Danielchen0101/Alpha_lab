#!/usr/bin/env python3
"""
验证USD-only修复
"""

import requests
import json
import time

def verify_usd_fix():
    """验证USD-only修复"""
    print("验证USD-only修复")
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
            
            # 1. 分析currency分布
            print(f"\n1. Currency分布分析:")
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
            
            # 2. 检查USD股票中market cap最大的
            print(f"\n2. USD股票中market cap排名:")
            print("-" * 60)
            
            # 过滤出有market cap的USD股票
            usd_with_cap = [(s, cap) for s, cap in usd_stocks if cap]
            
            if usd_with_cap:
                # 按market cap排序
                usd_with_cap.sort(key=lambda x: x[1], reverse=True)
                
                print(f"有效USD股票数量: {len(usd_with_cap)}/{len(usd_stocks)}")
                print(f"\nTop 5 USD股票:")
                for i, (symbol, cap) in enumerate(usd_with_cap[:5], 1):
                    cap_trillion = cap / 1_000_000_000_000
                    print(f"{i}. {symbol}: ${cap_trillion:.2f}T")
                
                largest_symbol, largest_cap = usd_with_cap[0]
                cap_trillion = largest_cap / 1_000_000_000_000
                print(f"\nUSD股票中Largest Cap应该是: {largest_symbol} ${cap_trillion:.2f}T")
                
                if largest_symbol == 'TSM':
                    print(f"❌ Largest Cap仍然是TSM（虽然currency=USD，但值异常）")
                else:
                    print(f"✅ Largest Cap是{largest_symbol}（正常USD股票）")
            else:
                print(f"没有USD股票有有效的market cap")
            
            # 3. 计算Total Market Cap（只统计USD股票）
            print(f"\n3. Total Market Cap计算（只统计USD股票）:")
            print("-" * 60)
            
            total_cap_usd = sum(cap for _, cap in usd_with_cap)
            total_cap_trillion = total_cap_usd / 1_000_000_000_000
            
            print(f"参与计算的USD股票数量: {len(usd_with_cap)}")
            print(f"Total Market Cap(USD only): ${total_cap_trillion:.2f}T")
            
            # 合理范围检查（应该在20T以内）
            if total_cap_trillion < 20:
                print(f"✅ Total Market Cap在合理范围内")
            else:
                print(f"❌ Total Market Cap仍然有问题: ${total_cap_trillion:.2f}T")
            
            # 4. 检查非USD股票的情况
            print(f"\n4. 非USD股票检查:")
            print("-" * 60)
            
            if non_usd_stocks:
                print(f"非USD股票 ({len(non_usd_stocks)}支):")
                for symbol, currency in non_usd_stocks:
                    # 找到对应的股票数据
                    stock = next((s for s in stocks if s.get('symbol') == symbol), None)
                    if stock:
                        market_cap = stock.get('marketCap')
                        if market_cap:
                            cap_trillion = market_cap / 1_000_000_000_000
                            print(f"  {symbol} ({currency}): ${cap_trillion:.2f}T")
                        else:
                            print(f"  {symbol} ({currency}): N/A")
                print(f"\n这些股票将不参与Largest Cap和Total Market Cap计算")
            else:
                print(f"当前没有非USD货币的股票")
            
            # 5. 总结
            print(f"\n5. 修复验证总结:")
            print("-" * 40)
            
            success = True
            
            # 检查Largest Cap不应该是TSM
            if usd_with_cap and usd_with_cap[0][0] == 'TSM':
                print(f"  ❌ Largest Cap仍然是TSM")
                success = False
            elif usd_with_cap:
                print(f"  ✅ Largest Cap是{usd_with_cap[0][0]}（正常USD股票）")
            else:
                print(f"  ⚠️  没有有效的USD market cap数据")
            
            # 检查Total Market Cap应该在合理范围
            if total_cap_trillion < 20:
                print(f"  ✅ Total Market Cap合理")
            else:
                print(f"  ❌ Total Market Cap异常")
                success = False
            
            # 检查非USD股票处理
            if non_usd_stocks:
                print(f"  ✅ 检测到{len(non_usd_stocks)}支非USD股票，将不参与计算")
            else:
                print(f"  ✅ 所有股票都是USD货币")
            
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
    verify_usd_fix()