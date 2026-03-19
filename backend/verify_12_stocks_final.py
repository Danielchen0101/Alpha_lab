#!/usr/bin/env python3
"""
最终验证12支股票
"""

import time
import requests

print("最终验证：Dashboard默认12支股票")
print("=" * 60)

base_url = "http://127.0.0.1:8889/api"

# 使用时间戳避免缓存
timestamp = int(time.time() * 1000)
url = f"{base_url}/market/stocks?dashboard=true&_={timestamp}"

print(f"请求URL: {url}")

start_time = time.time()
try:
    response = requests.get(url, timeout=15)
    elapsed = time.time() - start_time
    
    if response.status_code == 200:
        data = response.json()
        count = data.get('count', 0)
        stocks = data.get('stocks', [])
        
        print(f"\n响应:")
        print(f"  状态码: {response.status_code}")
        print(f"  耗时: {elapsed:.2f}秒")
        print(f"  股票数量: {count}支")
        print(f"  是否成功: {data.get('success', 'N/A')}")
        print(f"  API耗时: {data.get('elapsed', 0):.2f}秒")
        
        if 'errors' in data:
            print(f"  错误: {data.get('errors')}")
        
        # 显示股票列表
        symbols = [stock.get('symbol') for stock in stocks]
        print(f"\n  股票列表 ({len(symbols)}支):")
        for i, symbol in enumerate(sorted(symbols), 1):
            # 找到对应的股票数据
            stock_data = next((s for s in stocks if s.get('symbol') == symbol), {})
            price = stock_data.get('price')
            change_percent = stock_data.get('changePercent')
            marketcap = stock_data.get('marketCap')
            
            # 格式化marketcap
            if marketcap and marketcap >= 1e12:
                marketcap_str = f"${marketcap/1e12:.2f}T"
            elif marketcap and marketcap >= 1e9:
                marketcap_str = f"${marketcap/1e9:.2f}B"
            else:
                marketcap_str = f"${marketcap or 0:,.0f}"
            
            print(f"    {i:2d}. {symbol}: ${price or 'N/A'} "
                  f"({change_percent:+.2f}%), "
                  f"市值: {marketcap_str}")
        
        # 验证
        if count == 12:
            print(f"\n[SUCCESS] Dashboard默认已改为12支股票")
            print(f"  验证通过: Total Symbols = 12")
        elif count == 8:
            print(f"\n[ERROR] 仍然是8支股票")
            print(f"  需要检查代码执行路径")
        else:
            print(f"\n[WARNING] 异常数量: {count}支")
            
    else:
        print(f"\n[ERROR] 请求失败: {response.status_code}")
        print(f"  响应: {response.text[:200]}")
        
except Exception as e:
    print(f"\n[ERROR] 请求异常: {str(e)}")

print("\n" + "=" * 60)