"""
直接调试错误
"""

import requests
import time

# 测试Finnhub API是否工作
print("测试Finnhub API...")
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'

try:
    quote_url = 'https://finnhub.io/api/v1/quote'
    params = {'symbol': 'AAPL', 'token': FINNHUB_API_KEY}
    
    print(f"请求URL: {quote_url}")
    print(f"参数: {params}")
    
    response = requests.get(quote_url, params=params, timeout=5)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Finnhub响应成功: {data}")
    else:
        print(f"Finnhub错误: {response.text}")
        
except Exception as e:
    print(f"异常: {e}")
    import traceback
    traceback.print_exc()

print()
print("测试Twelve Data API...")
TWELVEDATA_API_KEY = '8b847a1ef2aa47a68d3f992bd0275f0c'

try:
    url = 'https://api.twelvedata.com/time_series'
    params = {
        'symbol': 'AAPL',
        'interval': '1h',
        'outputsize': 2,
        'apikey': TWELVEDATA_API_KEY,
        'format': 'JSON'
    }
    
    print(f"请求URL: {url}")
    print(f"参数: {params}")
    
    response = requests.get(url, params=params, timeout=5)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Twelve Data响应成功，数据条数: {len(data.get('values', []))}")
    else:
        print(f"Twelve Data错误: {response.text}")
        
except Exception as e:
    print(f"异常: {e}")
    import traceback
    traceback.print_exc()