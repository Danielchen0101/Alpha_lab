#!/usr/bin/env python3
"""
详细测试Alpaca API
"""

import requests
import json

def test_alpaca_direct():
    """直接测试Alpaca API"""
    print("Direct testing of Alpaca API...")
    print("=" * 70)
    
    # 使用真实的Alpaca密钥
    api_key = "AKOQQPZNXXOAYAZKDWF7LV4E3D"
    api_secret = "93oAgKVTjHjkyzA1fZpHeW4wUkwaYZvzEohcMe5dgXMP"
    
    headers = {
        'APCA-API-KEY-ID': api_key,
        'APCA-API-SECRET-KEY': api_secret
    }
    
    # 1. 测试Alpaca snapshots API
    print("\n1. Testing Alpaca snapshots API directly...")
    try:
        url = "https://data.alpaca.markets/v2/stocks/snapshots"
        params = {"symbols": "AAPL"}
        
        print(f"URL: {url}")
        print(f"Params: {params}")
        print(f"API Key (masked): {api_key[:6]}...{api_key[-4:]}")
        
        response = requests.get(url, headers=headers, params=params, timeout=10)
        
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            
            if 'AAPL' in data:
                aapl_data = data['AAPL']
                print(f"\nAAPL data structure:")
                for key, value in aapl_data.items():
                    print(f"  {key}: {type(value)}")
                    
                # 检查具体数据
                if 'latestTrade' in aapl_data:
                    trade = aapl_data['latestTrade']
                    print(f"\nLatest trade:")
                    print(f"  Price: {trade.get('p')}")
                    print(f"  Size: {trade.get('s')}")
                    print(f"  Time: {trade.get('t')}")
                    
                if 'latestQuote' in aapl_data:
                    quote = aapl_data['latestQuote']
                    print(f"\nLatest quote:")
                    print(f"  Bid: {quote.get('bp')}")
                    print(f"  Ask: {quote.get('ap')}")
                    print(f"  Bid size: {quote.get('bs')}")
                    print(f"  Ask size: {quote.get('as')}")
            else:
                print(f"No AAPL data in response")
        else:
            print(f"Error response: {response.text[:500]}")
            
    except Exception as e:
        print(f"Exception: {e}")
        import traceback
        traceback.print_exc()
    
    # 2. 测试后端接口的详细日志
    print("\n2. Testing backend interface with detailed logging...")
    try:
        base_url = "http://127.0.0.1:8889"
        response = requests.get(f"{base_url}/api/market/stock/AAPL", timeout=10)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success')}")
            print(f"Data source: {data.get('dataSource')}")
            print(f"Sources: {data.get('sources')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Exception: {e}")
    
    print("\n" + "=" * 70)
    print("Test completed")

if __name__ == "__main__":
    test_alpaca_direct()