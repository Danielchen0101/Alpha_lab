#!/usr/bin/env python3
"""
最终验证修复
"""

import requests
import json
import time

def final_test():
    """最终验证"""
    print("最终验证Dashboard数据修复")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 强制刷新，跳过缓存
        timestamp = int(time.time() * 1000)
        url = f"{base_url}/market/stocks?dashboard=true&_={timestamp}"
        
        print(f"请求URL: {url}")
        response = requests.get(url, timeout=20)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"获取到 {len(stocks)} 支股票")
            
            # 1. 检查TSM
            tsm_stock = next((s for s in stocks if s.get('symbol') == 'TSM'), None)
            if tsm_stock:
                print(f"\n1. TSM检查:")
                print(f"   Market Cap: {tsm_stock.get('marketCap')}")
                
                if tsm_stock.get('marketCap') is None:
                    print(f"   [SUCCESS] TSM market cap已修复为None")
                else:
                    cap = tsm_stock.get('marketCap')
                    cap_trillion = cap / 1_000_000_000_000
                    print(f"   [FAILED] TSM market cap仍然错误: ${cap_trillion:.2f}T")
            
            # 2. 找出Largest Cap（排除TSM）
            print(f"\n2. Largest Cap检查:")
            stocks_with_cap = [s for s in stocks if s.get('marketCap')]
            
            if stocks_with_cap:
                # 按marketCap排序
                sorted_stocks = sorted(stocks_with_cap, key=lambda x: x.get('marketCap', 0), reverse=True)
                
                print(f"   Market Cap排名:")
                for i, stock in enumerate(sorted_stocks[:5], 1):
                    cap = stock.get('marketCap', 0)
                    cap_trillion = cap / 1_000_000_000_000
                    print(f"     {i}. {stock.get('symbol')}: ${cap_trillion:.2f}T")
                
                largest = sorted_stocks[0]
                cap = largest.get('marketCap', 0)
                cap_trillion = cap / 1_000_000_000_000
                
                print(f"\n   Largest Cap: {largest.get('symbol')} ${cap_trillion:.2f}T")
                
                if largest.get('symbol') == 'TSM':
                    print(f"   [FAILED] Largest Cap仍然是TSM")
                else:
                    print(f"   [SUCCESS] Largest Cap是{largest.get('symbol')}")
            else:
                print(f"   [INFO] 没有股票有market cap数据")
            
            # 3. 计算Total Market Cap
            print(f"\n3. Total Market Cap检查:")
            total_cap = sum(s.get('marketCap', 0) for s in stocks if s.get('marketCap'))
            total_cap_trillion = total_cap / 1_000_000_000_000
            
            print(f"   计算值: ${total_cap_trillion:.2f}T")
            
            # 合理范围检查（排除TSM的错误值后应该在20T以内）
            if total_cap_trillion < 20:
                print(f"   [SUCCESS] Total Market Cap ${total_cap_trillion:.2f}T 在合理范围内")
            else:
                print(f"   [WARNING] Total Market Cap ${total_cap_trillion:.2f}T 可能仍有问题")
            
            # 4. 其他summary
            print(f"\n4. 其他summary检查:")
            
            # Market Gainers/Losers
            gainers = len([s for s in stocks if s.get('changePercent', 0) > 0.1])
            losers = len([s for s in stocks if s.get('changePercent', 0) < -0.1])
            neutral = len(stocks) - gainers - losers
            
            print(f"   Market Gainers: {gainers}")
            print(f"   Market Losers: {losers}")
            print(f"   Neutral: {neutral}")
            
            # Largest Move
            if stocks:
                largest_move = max(stocks, key=lambda x: abs(x.get('changePercent', 0)))
                print(f"   Largest Move: {largest_move.get('symbol')} {largest_move.get('changePercent', 0):.2f}%")
            
            # 5. 总结
            print(f"\n5. 修复验证总结:")
            print("-" * 40)
            
            success = True
            
            # 检查TSM
            if tsm_stock and tsm_stock.get('marketCap') is not None:
                print(f"   ❌ TSM market cap未修复")
                success = False
            else:
                print(f"   ✅ TSM market cap已修复")
            
            # 检查Largest Cap
            if stocks_with_cap and stocks_with_cap[0].get('symbol') == 'TSM':
                print(f"   ❌ Largest Cap仍然是TSM")
                success = False
            elif stocks_with_cap:
                print(f"   ✅ Largest Cap是{stocks_with_cap[0].get('symbol')}")
            else:
                print(f"   ⚠️  没有有效的market cap数据")
            
            # 检查Total Market Cap
            if total_cap_trillion < 20:
                print(f"   ✅ Total Market Cap合理")
            else:
                print(f"   ⚠️  Total Market Cap可能有问题")
            
            if success:
                print(f"\n   [总体结果] ✅ 所有问题已修复!")
            else:
                print(f"\n   [总体结果] ❌ 仍有问题需要修复")
            
            # 6. 当前15支股票列表
            print(f"\n6. 当前15支股票列表:")
            symbols = [s.get('symbol') for s in stocks]
            print(f"   {', '.join(symbols)}")
            
        else:
            print(f"请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"验证异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    final_test()