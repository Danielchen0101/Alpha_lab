#!/usr/bin/env python3
"""
强制刷新Dashboard数据，跳过缓存
"""

import requests
import json
import time

def force_refresh():
    """强制刷新"""
    print("强制刷新Dashboard数据")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    # 方法1: 添加随机参数跳过缓存
    timestamp = int(time.time() * 1000)
    url = f"{base_url}/market/stocks?dashboard=true&force=true&_={timestamp}"
    
    print(f"请求URL: {url}")
    
    try:
        response = requests.get(url, timeout=20)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"获取到 {len(stocks)} 支股票")
            
            # 检查TSM
            tsm_stock = next((s for s in stocks if s.get('symbol') == 'TSM'), None)
            if tsm_stock:
                print(f"\nTSM数据:")
                print(f"  Market Cap: {tsm_stock.get('marketCap')}")
                
                if tsm_stock.get('marketCap') is None:
                    print(f"  ✅ TSM market cap已修复为None")
                else:
                    cap = tsm_stock.get('marketCap')
                    cap_trillion = cap / 1_000_000_000_000
                    print(f"  ❌ TSM market cap仍然错误: ${cap_trillion:.2f}T")
            
            # 检查Largest Cap
            stocks_with_cap = [s for s in stocks if s.get('marketCap')]
            if stocks_with_cap:
                largest = max(stocks_with_cap, key=lambda x: x.get('marketCap', 0))
                cap = largest.get('marketCap', 0)
                cap_trillion = cap / 1_000_000_000_000
                
                print(f"\nLargest Cap:")
                print(f"  股票: {largest.get('symbol')}")
                print(f"  市值: ${cap_trillion:.2f}T")
                
                if largest.get('symbol') == 'TSM':
                    print(f"  ❌ Largest Cap仍然是TSM")
                else:
                    print(f"  ✅ Largest Cap是{largest.get('symbol')}")
            
            # 检查后端日志
            print(f"\n检查后端日志中是否有修复信息...")
            print(f"(请查看后端控制台是否有'[FIX]'或'[INFO]'日志)")
            
        else:
            print(f"请求失败: {response.status_code}")
            print(f"响应: {response.text[:200]}")
            
    except Exception as e:
        print(f"请求异常: {str(e)}")
    
    print(f"\n" + "=" * 60)
    
    # 方法2: 直接调用清除缓存端点（如果存在）
    print(f"\n尝试清除缓存...")
    try:
        clear_url = f"{base_url}/clear_cache"
        response = requests.get(clear_url, timeout=5)
        print(f"清除缓存响应: {response.status_code}")
    except:
        print(f"清除缓存端点不存在或失败")

if __name__ == "__main__":
    force_refresh()