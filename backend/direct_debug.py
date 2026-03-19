#!/usr/bin/env python3
"""
直接调试：找出为什么只返回8支股票
"""

import requests
import json

# 测试完整的12支
symbols_12 = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM", "JNJ", "WMT", "V", "PG"]
symbols_param = ','.join(symbols_12)

url = f"http://127.0.0.1:8889/api/market/stocks?dashboard=true&symbols={symbols_param}"
print(f"测试URL: {url}")

try:
    response = requests.get(url, timeout=15)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n响应数据:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        print(f"\n分析:")
        print(f"count: {data.get('count')}")
        print(f"success: {data.get('success')}")
        
        if 'errors' in data:
            print(f"errors: {data.get('errors')}")
            
        stocks = data.get('stocks', [])
        returned_symbols = [s.get('symbol') for s in stocks]
        
        print(f"\n返回的股票 ({len(returned_symbols)}支): {', '.join(sorted(returned_symbols))}")
        
        # 检查缺失的
        missing = set(symbols_12) - set(returned_symbols)
        if missing:
            print(f"缺失的股票 ({len(missing)}支): {', '.join(sorted(missing))}")
            
            # 单独测试缺失的股票
            print(f"\n单独测试缺失的股票:")
            for symbol in sorted(missing):
                test_url = f"http://127.0.0.1:8889/api/market/stock/{symbol}"
                try:
                    test_resp = requests.get(test_url, timeout=5)
                    if test_resp.status_code == 200:
                        test_data = test_resp.json()
                        print(f"  {symbol}: ✅ 成功 (price=${test_data.get('price')})")
                    else:
                        print(f"  {symbol}: ❌ 失败 (状态码: {test_resp.status_code})")
                except Exception as e:
                    print(f"  {symbol}: ❌ 异常 ({str(e)})")
        else:
            print(f"✅ 所有12支股票都返回了")
            
    else:
        print(f"错误: {response.text[:200]}")
        
except Exception as e:
    print(f"异常: {str(e)}")