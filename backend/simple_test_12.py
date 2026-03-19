#!/usr/bin/env python3
"""
简单测试12支股票
"""

import requests
import json

# 测试
url = "http://127.0.0.1:8889/api/market/stocks?dashboard=true"
print(f"测试URL: {url}")

try:
    response = requests.get(url, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"股票数量: {data.get('count')}")
        
        stocks = data.get('stocks', [])
        symbols = [s.get('symbol') for s in stocks]
        print(f"股票列表 ({len(symbols)}支): {', '.join(sorted(symbols))}")
        
        # 检查是否是12支
        if len(symbols) == 12:
            print("✅ Dashboard默认已改为12支股票")
        elif len(symbols) == 8:
            print("❌ Dashboard仍然是8支股票，修改未生效")
        else:
            print(f"⚠️  异常数量: {len(symbols)}支")
            
    else:
        print(f"错误: {response.text[:200]}")
        
except Exception as e:
    print(f"异常: {str(e)}")