#!/usr/bin/env python3
"""
测试股票API返回的字段
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8889/api"

def test_stock_api():
    """测试股票API返回字段"""
    print("=== Testing Stock API Fields ===")
    
    symbol = "AAPL"
    url = f"{BASE_URL}/market/stock/{symbol}"
    
    try:
        response = requests.get(url, timeout=10)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nResponse fields:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            # 检查关键字段
            print(f"\nKey fields check:")
            print(f"  symbol: {data.get('symbol')}")
            print(f"  price: {data.get('price')}")
            print(f"  change: {data.get('change')}")
            print(f"  changePercent: {data.get('changePercent')}")
            print(f"  dayHigh: {data.get('dayHigh')} (type: {type(data.get('dayHigh'))})")
            print(f"  dayLow: {data.get('dayLow')} (type: {type(data.get('dayLow'))})")
            print(f"  previousClose: {data.get('previousClose')} (type: {type(data.get('previousClose'))})")
            print(f"  high: {data.get('high')} (should be None)")
            print(f"  low: {data.get('low')} (should be None)")
            print(f"  prevClose: {data.get('prevClose')} (should be None)")
            print(f"  dataSource: {data.get('dataSource')}")
            
            # 检查Finnhub quote数据
            print(f"\nFinnhub quote data check:")
            print(f"  Note: Finnhub quote API returns:")
            print(f"    'c': current price")
            print(f"    'h': high price of the day")
            print(f"    'l': low price of the day")
            print(f"    'pc': previous close price")
            print(f"    'd': change")
            print(f"    'dp': change percent")
            
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Request error: {e}")

def test_finnhub_quote_directly():
    """直接测试Finnhub quote API"""
    print("\n=== Testing Finnhub Quote API Directly ===")
    
    import requests
    import time
    
    FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
    FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'
    
    symbol = "AAPL"
    url = f"{FINNHUB_BASE_URL}/quote"
    params = {
        'symbol': symbol,
        'token': FINNHUB_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"Finnhub quote response:")
            print(json.dumps(data, indent=2))
            
            print(f"\nFinnhub field mapping:")
            print(f"  'c' (current): {data.get('c')}")
            print(f"  'h' (high): {data.get('h')}")
            print(f"  'l' (low): {data.get('l')}")
            print(f"  'pc' (previous close): {data.get('pc')}")
            print(f"  'd' (change): {data.get('d')}")
            print(f"  'dp' (change percent): {data.get('dp')}")
            print(f"  'v' (volume): {data.get('v')}")
            
        else:
            print(f"Finnhub error: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"Finnhub request error: {e}")

if __name__ == "__main__":
    print("NOTE: Make sure backend is running on port 8889")
    print("="*50)
    
    test_stock_api()
    test_finnhub_quote_directly()