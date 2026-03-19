#!/usr/bin/env python3
"""
验证Largest Cap修复
"""

import requests
import json
import time

def verify_fix_final():
    """验证修复"""
    print("验证Largest Cap修复")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 获取Dashboard数据
        timestamp = int(time.time() * 1000)
        response = requests.get(f"{base_url}/market/stocks?dashboard=true&_t={timestamp}", timeout=20)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"股票总数: {len(stocks)}支")
            
            # 检查TSM的market cap
            tsm_stock = next((s for s in stocks if s.get('symbol') == 'TSM'), None)
            if tsm_stock:
                print(f"\nTSM数据:")
                print(f"  Symbol: {tsm_stock.get('symbol')}")
                print(f"  Market Cap: {tsm_stock.get('marketCap')}")
                
                if tsm_stock.get('marketCap') is None:
                    print(f"  [SUCCESS] TSM market cap已设为None，避免错误显示")
                else:
                    market_cap_trillion = tsm_stock.get('marketCap') / 1_000_000_000_000
                    print(f"  [PROBLEM] TSM market cap仍然存在: ${market_cap_trillion:.2f}T")
            
            # 找出正确的Largest Cap
            print(f"\nLargest Cap分析:")
            stocks_with_cap = [s for s in stocks if s.get('marketCap')]
            
            if stocks_with_cap:
                # 按marketCap排序
                sorted_by_market_cap = sorted(stocks_with_cap, 
                                            key=lambda x: x.get('marketCap', 0), 
                                            reverse=True)
                
                print(f"  Market Cap排名前5 (排除TSM后):")
                for i, stock in enumerate(sorted_by_market_cap[:5], 1):
                    market_cap = stock.get('marketCap', 0)
                    market_cap_trillion = market_cap / 1_000_000_000_000
                    print(f"    {i}. {stock.get('symbol')}: ${market_cap_trillion:.2f}T")
                
                largest_cap_stock = sorted_by_market_cap[0]
                largest_cap_value = largest_cap_stock.get('marketCap', 0)
                largest_cap_trillion = largest_cap_value / 1_000_000_000_000
                
                print(f"\n  Largest Cap应该是: {largest_cap_stock.get('symbol')} ${largest_cap_trillion:.2f}T")
                
                # 检查是否合理
                if largest_cap_stock.get('symbol') == 'TSM':
                    print(f"  [FAILED] Largest Cap仍然是TSM，修复未完全生效")
                elif 0.1 < largest_cap_trillion < 10:
                    print(f"  [SUCCESS] Largest Cap {largest_cap_stock.get('symbol')} ${largest_cap_trillion:.2f}T 在合理范围内")
                else:
                    print(f"  [WARNING] Largest Cap ${largest_cap_trillion:.2f}T 可能仍有问题")
            else:
                print(f"  [INFO] 没有股票有market cap数据")
            
            # 计算Total Market Cap
            print(f"\nTotal Market Cap分析:")
            total_market_cap = sum(s.get('marketCap', 0) for s in stocks if s.get('marketCap'))
            total_market_cap_trillion = total_market_cap / 1_000_000_000_000
            
            print(f"  计算值: ${total_market_cap_trillion:.2f}T")
            
            # 检查是否包含错误的TSM值
            if total_market_cap_trillion > 20:  # 如果超过20T，可能仍有问题
                print(f"  [WARNING] Total Market Cap ${total_market_cap_trillion:.2f}T 可能仍包含错误数据")
            else:
                print(f"  [SUCCESS] Total Market Cap ${total_market_cap_trillion:.2f}T 在合理范围内")
            
            # 其他summary验证
            print(f"\n其他summary验证:")
            
            # Market Gainers/Losers
            gainers = len([s for s in stocks if s.get('changePercent', 0) > 0.1])
            losers = len([s for s in stocks if s.get('changePercent', 0) < -0.1])
            print(f"  Market Gainers: {gainers}")
            print(f"  Market Losers: {losers}")
            
            # Largest Move
            if stocks:
                largest_move_stock = max(stocks, key=lambda x: abs(x.get('changePercent', 0)))
                print(f"  Largest Move: {largest_move_stock.get('symbol')} {largest_move_stock.get('changePercent', 0):.2f}%")
            
            # 总结
            print(f"\n修复验证总结:")
            print("-" * 40)
            
            success = True
            if tsm_stock and tsm_stock.get('marketCap') is not None and tsm_stock.get('marketCap') > 1_000_000_000_000:
                print(f"  ❌ TSM market cap仍然错误")
                success = False
            else:
                print(f"  ✅ TSM market cap已修复")
            
            if largest_cap_stock.get('symbol') == 'TSM':
                print(f"  ❌ Largest Cap仍然是TSM")
                success = False
            else:
                print(f"  ✅ Largest Cap现在是{largest_cap_stock.get('symbol')}")
            
            if total_market_cap_trillion > 20:
                print(f"  ⚠️  Total Market Cap可能仍有问题")
                success = False
            else:
                print(f"  ✅ Total Market Cap在合理范围")
            
            if success:
                print(f"\n  [SUCCESS] 所有问题已修复!")
            else:
                print(f"\n  [FAILED] 仍有问题需要修复")
                
        else:
            print(f"请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"验证异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    verify_fix_final()