#!/usr/bin/env python3
"""
最终验证修复
"""

import requests
import json
import time

def final_verification():
    """最终验证"""
    print("最终验证Dashboard修复")
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
                    print(f"   ✅ TSM market cap已设为None")
                else:
                    cap = tsm_stock.get('marketCap')
                    cap_trillion = cap / 1_000_000_000_000
                    print(f"   ❌ TSM market cap仍然错误: ${cap_trillion:.2f}T")
            
            # 2. 找出Largest Cap（排除None值）
            print(f"\n2. Largest Cap检查:")
            stocks_with_cap = [s for s in stocks if s.get('marketCap')]
            
            if stocks_with_cap:
                # 按marketCap排序
                sorted_stocks = sorted(stocks_with_cap, key=lambda x: x.get('marketCap', 0), reverse=True)
                
                print(f"   有效股票排名:")
                for i, stock in enumerate(sorted_stocks[:5], 1):
                    cap = stock.get('marketCap', 0)
                    cap_trillion = cap / 1_000_000_000_000
                    print(f"     {i}. {stock.get('symbol')}: ${cap_trillion:.2f}T")
                
                largest = sorted_stocks[0]
                cap = largest.get('marketCap', 0)
                cap_trillion = cap / 1_000_000_000_000
                
                print(f"\n   Largest Cap: {largest.get('symbol')} ${cap_trillion:.2f}T")
                
                if largest.get('symbol') == 'TSM':
                    print(f"   ❌ Largest Cap仍然是TSM")
                else:
                    print(f"   ✅ Largest Cap是{largest.get('symbol')}")
            else:
                print(f"   [INFO] 没有股票有market cap数据")
            
            # 3. 计算Total Market Cap
            print(f"\n3. Total Market Cap检查:")
            total_cap = sum(s.get('marketCap', 0) for s in stocks if s.get('marketCap'))
            total_cap_trillion = total_cap / 1_000_000_000_000
            
            valid_count = len([s for s in stocks if s.get('marketCap')])
            print(f"   有效股票数量: {valid_count}/{len(stocks)}")
            print(f"   Total Market Cap: ${total_cap_trillion:.2f}T")
            
            # 合理范围检查（排除TSM后应该在20T以内）
            if total_cap_trillion < 20:
                print(f"   ✅ Total Market Cap在合理范围内")
            else:
                print(f"   ❌ Total Market Cap仍然有问题: ${total_cap_trillion:.2f}T")
            
            # 4. 检查后端日志输出
            print(f"\n4. 后端日志检查:")
            print(f"   请查看后端控制台，确认是否有:")
            print(f"   - [跳过转换] TSM: 值过大(...)")
            print(f"   - [正常转换] 其他股票")
            
            # 5. 总结
            print(f"\n5. 修复验证总结:")
            print("-" * 40)
            
            # 检查关键指标
            success = True
            
            # TSM应该为None
            if tsm_stock and tsm_stock.get('marketCap') is None:
                print(f"   ✅ TSM market cap已正确设为None")
            elif tsm_stock:
                print(f"   ❌ TSM market cap未修复")
                success = False
            else:
                print(f"   ⚠️  TSM不在列表中")
            
            # Largest Cap不应该是TSM
            if stocks_with_cap and stocks_with_cap[0].get('symbol') != 'TSM':
                print(f"   ✅ Largest Cap不是TSM")
            elif stocks_with_cap:
                print(f"   ❌ Largest Cap仍然是TSM")
                success = False
            else:
                print(f"   ⚠️  没有有效的market cap数据")
            
            # Total Market Cap应该在合理范围
            if total_cap_trillion < 20:
                print(f"   ✅ Total Market Cap合理")
            else:
                print(f"   ❌ Total Market Cap异常")
                success = False
            
            if success:
                print(f"\n   🎉 [总体结果] 修复成功!")
            else:
                print(f"\n   ❌ [总体结果] 修复失败")
            
        else:
            print(f"请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"验证异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    final_verification()