#!/usr/bin/env python3
"""
验证通用修复方案
"""

import requests
import json
import time

def verify_generic_fix():
    """验证通用修复"""
    print("验证通用修复方案")
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
            
            # 1. 检查所有股票的market cap
            print(f"\n1. 所有股票的market cap核对表:")
            print("-" * 60)
            print(f"{'Symbol':<8} {'Currency':<10} {'MarketCap原始值':<25} {'转换后':<15} {'状态':<10}")
            print("-" * 60)
            
            valid_stocks = []
            invalid_stocks = []
            
            for stock in stocks:
                symbol = stock.get('symbol', 'N/A')
                currency = stock.get('currency', 'USD')
                market_cap = stock.get('marketCap')
                
                if market_cap:
                    market_cap_trillion = market_cap / 1_000_000_000_000
                    status = "有效"
                    valid_stocks.append((symbol, market_cap_trillion))
                    print(f"{symbol:<8} {currency:<10} {str(market_cap)[:20]:<25} ${market_cap_trillion:<14.2f}T {status:<10}")
                else:
                    status = "无效"
                    invalid_stocks.append(symbol)
                    print(f"{symbol:<8} {currency:<10} {'N/A':<25} {'N/A':<15} {status:<10}")
            
            # 2. 计算Largest Cap（只使用有效股票）
            print(f"\n2. Largest Cap计算:")
            print("-" * 60)
            
            if valid_stocks:
                # 按market cap排序
                valid_stocks.sort(key=lambda x: x[1], reverse=True)
                
                print(f"有效股票排名:")
                for i, (symbol, cap_trillion) in enumerate(valid_stocks[:5], 1):
                    print(f"  {i}. {symbol}: ${cap_trillion:.2f}T")
                
                largest_symbol, largest_cap = valid_stocks[0]
                print(f"\nLargest Cap应该是: {largest_symbol} ${largest_cap:.2f}T")
                
                if largest_symbol == 'TSM':
                    print(f"[FAILED] Largest Cap仍然是TSM")
                else:
                    print(f"[SUCCESS] Largest Cap是{largest_symbol}")
            else:
                print(f"[INFO] 没有有效的market cap数据")
            
            # 3. 计算Total Market Cap（只使用有效股票）
            print(f"\n3. Total Market Cap计算:")
            print("-" * 60)
            
            total_cap = sum(market_cap for market_cap in [s.get('marketCap') for s in stocks] if market_cap)
            total_cap_trillion = total_cap / 1_000_000_000_000
            
            print(f"有效股票数量: {len(valid_stocks)}/{len(stocks)}")
            print(f"Total Market Cap: ${total_cap_trillion:.2f}T")
            
            # 合理范围检查（排除TSM后应该在20T以内）
            if total_cap_trillion < 20:
                print(f"[SUCCESS] Total Market Cap在合理范围内")
            else:
                print(f"[WARNING] Total Market Cap可能仍有问题")
            
            # 4. 检查无效股票
            print(f"\n4. 无效股票分析:")
            print("-" * 60)
            
            if invalid_stocks:
                print(f"无效股票 ({len(invalid_stocks)}支): {', '.join(invalid_stocks)}")
                
                # 分析每个无效股票的原因
                for symbol in invalid_stocks:
                    stock = next((s for s in stocks if s.get('symbol') == symbol), None)
                    if stock:
                        currency = stock.get('currency', 'USD')
                        market_cap_raw = stock.get('marketCap')
                        print(f"  {symbol}: currency={currency}, marketCap={'N/A' if market_cap_raw is None else market_cap_raw}")
            else:
                print(f"所有股票都有有效的market cap")
            
            # 5. 总结
            print(f"\n5. 修复验证总结:")
            print("-" * 60)
            
            success = True
            
            # 检查TSM是否被正确处理
            tsm_stock = next((s for s in stocks if s.get('symbol') == 'TSM'), None)
            if tsm_stock and tsm_stock.get('marketCap') is not None:
                cap = tsm_stock.get('marketCap')
                cap_trillion = cap / 1_000_000_000_000
                if cap_trillion > 10:
                    print(f"  ❌ TSM仍然有错误的market cap: ${cap_trillion:.2f}T")
                    success = False
                else:
                    print(f"  ✅ TSM market cap已修复: ${cap_trillion:.2f}T")
            elif tsm_stock:
                print(f"  ✅ TSM market cap已设为None")
            else:
                print(f"  ⚠️  TSM不在股票列表中")
            
            # 检查Largest Cap
            if valid_stocks and valid_stocks[0][0] == 'TSM':
                print(f"  ❌ Largest Cap仍然是TSM")
                success = False
            elif valid_stocks:
                print(f"  ✅ Largest Cap是{valid_stocks[0][0]}")
            else:
                print(f"  ⚠️  没有有效的Largest Cap")
            
            # 检查Total Market Cap
            if total_cap_trillion < 20:
                print(f"  ✅ Total Market Cap合理")
            else:
                print(f"  ⚠️  Total Market Cap可能有问题")
                success = False
            
            if success:
                print(f"\n  [总体结果] ✅ 通用修复成功!")
            else:
                print(f"\n  [总体结果] ❌ 修复仍有问题")
            
            # 6. 当前15支股票列表
            print(f"\n6. 当前15支股票列表:")
            symbols = [s.get('symbol') for s in stocks]
            print(f"  {', '.join(symbols)}")
            
        else:
            print(f"请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"验证异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    verify_generic_fix()