#!/usr/bin/env python3
"""
测试特定股票
"""

import requests

# 测试可能失败的股票
test_symbols = ["JNJ", "WMT", "V", "PG", "UNH"]

base_url = "http://127.0.0.1:8889/api"

print("测试可能失败的股票")
print("=" * 60)

for symbol in test_symbols:
    print(f"\n测试 {symbol}:")
    try:
        response = requests.get(f"{base_url}/market/stock/{symbol}", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print(f"  [成功] price=${data.get('price')}, name={data.get('name')}")
        else:
            print(f"  [失败] 状态码 {response.status_code}")
            print(f"     响应: {response.text[:100]}")
            
    except Exception as e:
        print(f"  [异常] {str(e)}")

# 测试完整的12支
print(f"\n\n测试完整的12支股票:")
symbols_12 = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM", "JNJ", "WMT", "V", "PG"]
symbols_param = ','.join(symbols_12)

try:
    response = requests.get(f"{base_url}/market/stocks?dashboard=true&symbols={symbols_param}", timeout=15)
    
    if response.status_code == 200:
        data = response.json()
        print(f"  状态码: {response.status_code}")
        print(f"  股票数量: {data.get('count')}")
        print(f"  是否成功: {data.get('success')}")
        
        if 'errors' in data:
            print(f"  错误: {data.get('errors')}")
            
        stocks = data.get('stocks', [])
        returned_symbols = [s.get('symbol') for s in stocks]
        print(f"  返回的股票: {', '.join(sorted(returned_symbols))}")
        
        # 检查缺失的股票
        missing = set(symbols_12) - set(returned_symbols)
        if missing:
            print(f"  缺失的股票: {', '.join(sorted(missing))}")
        else:
            print(f"  ✅ 所有12支股票都返回了")
            
    else:
        print(f"  请求失败: {response.status_code}")
        
except Exception as e:
    print(f"  异常: {str(e)}")