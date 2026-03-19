#!/usr/bin/env python3
"""
测试Finnhub candle API是否可用 - 简单版本
"""

import requests
import time
from datetime import datetime

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

def test_finnhub_candle_api():
    """测试Finnhub candle API"""
    print("=== Testing Finnhub candle API ===")
    
    # 测试参数
    symbol = "AAPL"
    resolution = "D"  # 日线数据
    end_time = int(time.time())
    start_time = end_time - (30 * 24 * 60 * 60)  # 30天前
    
    url = f"{FINNHUB_BASE_URL}/stock/candle"
    params = {
        'symbol': symbol,
        'resolution': resolution,
        'from': start_time,
        'to': end_time,
        'token': FINNHUB_API_KEY
    }
    
    print(f"URL: {url}")
    print(f"Params: {params}")
    print(f"API Key: {FINNHUB_API_KEY[:8]}...{FINNHUB_API_KEY[-8:]}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        
        print(f"\nStatus Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {data}")
            
            if data.get('s') == 'ok':
                print(f"SUCCESS: Finnhub candle API works")
                print(f"Data points: {len(data.get('t', []))}")
                if len(data.get('t', [])) > 0:
                    print(f"First data time: {datetime.fromtimestamp(data['t'][0])}")
                    print(f"Last data time: {datetime.fromtimestamp(data['t'][-1])}")
            else:
                print(f"ERROR: Finnhub returned error status: {data.get('s', 'unknown')}")
                print(f"Error message: {data.get('error', 'No error message')}")
        elif response.status_code == 403:
            print(f"ERROR: 403 Forbidden - API Key may be invalid or insufficient permissions")
            print(f"Response: {response.text[:500]}")
        elif response.status_code == 429:
            print(f"ERROR: 429 Too Many Requests - API rate limit exceeded")
        else:
            print(f"ERROR: Other error: {response.status_code}")
            print(f"Response: {response.text[:500]}")
            
    except Exception as e:
        print(f"ERROR: Request exception: {e}")

def test_finnhub_quote_api():
    """测试Finnhub quote API（对比）"""
    print("\n=== Testing Finnhub quote API (for comparison) ===")
    
    symbol = "AAPL"
    url = f"{FINNHUB_BASE_URL}/quote"
    params = {
        'symbol': symbol,
        'token': FINNHUB_API_KEY
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"SUCCESS: Finnhub quote API works")
            print(f"Current price: {data.get('c', 'N/A')}")
        else:
            print(f"ERROR: Finnhub quote API error: {response.status_code}")
            print(f"Response: {response.text[:200]}")
            
    except Exception as e:
        print(f"ERROR: Request exception: {e}")

if __name__ == "__main__":
    test_finnhub_candle_api()
    test_finnhub_quote_api()