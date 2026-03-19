#!/usr/bin/env python3
"""
测试Finnhub其他API是否可用
"""

import requests
import time

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

def test_finnhub_api(endpoint, params=None):
    """测试Finnhub API"""
    if params is None:
        params = {}
    
    params['token'] = FINNHUB_API_KEY
    
    url = f"{FINNHUB_BASE_URL}/{endpoint}"
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"\n{endpoint}:")
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and data.get('error'):
                print(f"  ERROR: {data.get('error')}")
            else:
                print(f"  SUCCESS: API works")
                # 显示部分数据
                if isinstance(data, list) and len(data) > 0:
                    print(f"  Data count: {len(data)}")
                    print(f"  First item: {data[0]}")
                elif isinstance(data, dict):
                    print(f"  Data keys: {list(data.keys())[:5]}...")
        else:
            print(f"  Response: {response.text[:200]}")
            
    except Exception as e:
        print(f"  Exception: {e}")

# 测试各种Finnhub API
print("=== Testing Finnhub APIs ===")

# 1. 实时报价API（已知可用）
test_finnhub_api("quote", {'symbol': 'AAPL'})

# 2. 公司信息API
test_finnhub_api("stock/profile2", {'symbol': 'AAPL'})

# 3. 财务指标API
test_finnhub_api("stock/metric", {'symbol': 'AAPL', 'metric': 'all'})

# 4. 推荐评级API
test_finnhub_api("stock/recommendation", {'symbol': 'AAPL'})

# 5. 价格目标API
test_finnhub_api("stock/price-target", {'symbol': 'AAPL'})

# 6. 新闻API
test_finnhub_api("company-news", {'symbol': 'AAPL', 'from': '2026-03-01', 'to': '2026-03-17'})

# 7. 市场新闻API
test_finnhub_api("news", {'category': 'general'})

# 8. 经济指标API
test_finnhub_api("economic-calendar", {'from': '2026-03-01', 'to': '2026-03-17'})

# 9. 技术指标API（可能可用）
test_finnhub_api("indicator", {
    'symbol': 'AAPL',
    'resolution': 'D',
    'from': int(time.time()) - (30 * 24 * 60 * 60),
    'to': int(time.time()),
    'indicator': 'sma',
    'timeperiod': 20
})

print("\n=== Summary ===")
print("Finnhub免费版通常提供:")
print("- quote: 实时报价 ✓")
print("- profile2: 公司信息 ✓")
print("- metric: 财务指标 ✓")
print("- recommendation: 推荐评级 ✓")
print("- price-target: 价格目标 ✓")
print("- company-news: 公司新闻 ✓")
print("- news: 市场新闻 ✓")
print("- economic-calendar: 经济日历 ✓")
print("- indicator: 技术指标 ✓")
print("- candle: 历史K线数据 ✗ (需要付费版)")