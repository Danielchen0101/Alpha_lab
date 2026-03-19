#!/usr/bin/env python3
"""
调试API响应
"""

import requests
import json

url = "http://127.0.0.1:8889/api/market/stocks?dashboard=true"
print(f"请求: {url}")

try:
    response = requests.get(url, timeout=15)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n完整响应:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        print(f"\n分析:")
        print(f"count: {data.get('count')}")
        print(f"success: {data.get('success')}")
        print(f"source: {data.get('source')}")
        print(f"elapsed: {data.get('elapsed')}")
        
        if 'errors' in data:
            print(f"errors: {data.get('errors')}")
            
        stocks = data.get('stocks', [])
        print(f"\n股票详情 ({len(stocks)}支):")
        for stock in stocks:
            print(f"  {stock.get('symbol')}: price=${stock.get('price')}, "
                  f"change={stock.get('changePercent')}%, "
                  f"sector={stock.get('sector')}")
                  
    else:
        print(f"错误响应: {response.text}")
        
except Exception as e:
    print(f"异常: {str(e)}")