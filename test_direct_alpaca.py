#!/usr/bin/env python3
"""
直接测试Alpaca API调用
"""

import requests
import json
import sys
import os

# 添加backend目录到Python路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def test_direct_alpaca():
    """直接测试Alpaca API"""
    print("Direct Alpaca API Test")
    print("=" * 80)
    
    # 导入后端函数
    try:
        from start_quant_backend import fetch_alpaca_stock_data, fetch_alpaca_stock_data_snapshot
        
        symbol = "AAPL"
        
        # 1. 测试单只股票函数（AI分析使用的）
        print(f"\n1. Testing fetch_alpaca_stock_data for {symbol}...")
        data, error = fetch_alpaca_stock_data(symbol)
        
        print(f"Error: {error}")
        if data:
            print(f"Data keys: {list(data.keys())}")
            print(f"Price: {data.get('price')}")
            print(f"Change %: {data.get('changePercent')}")
            print(f"Volume: {data.get('volume')}")
            print(f"Day High: {data.get('dayHigh')}")
            print(f"Day Low: {data.get('dayLow')}")
            print(f"Previous Close: {data.get('previousClose')}")
            print(f"Session Type: {data.get('sessionType')}")
            print(f"Is Fallback: {data.get('isFallback')}")
        else:
            print("No data returned")
        
        # 2. 测试批量函数（UI使用的）
        print(f"\n2. Testing fetch_alpaca_stock_data_snapshot for {symbol}...")
        data_dict, errors = fetch_alpaca_stock_data_snapshot([symbol])
        
        print(f"Errors: {errors}")
        if symbol.upper() in data_dict:
            data = data_dict[symbol.upper()]
            print(f"Data keys: {list(data.keys())}")
            print(f"Price: {data.get('price')}")
            print(f"Change %: {data.get('changePercent')}")
            print(f"Volume: {data.get('volume')}")
            print(f"Day High: {data.get('dayHigh')}")
            print(f"Day Low: {data.get('dayLow')}")
            print(f"Previous Close: {data.get('previousClose')}")
            print(f"Session Type: {data.get('sessionType')}")
            print(f"Is Fallback: {data.get('isFallback')}")
        else:
            print(f"No data for {symbol}")
            
    except Exception as e:
        print(f"Import error: {e}")
        import traceback
        traceback.print_exc()
    
    # 3. 直接调用Alpaca API
    print(f"\n3. Direct Alpaca API Call...")
    
    # 从config.py读取密钥
    try:
        import config
        api_key = config.ALPACA_API_KEY
        api_secret = config.ALPACA_API_SECRET
        
        print(f"API Key (masked): {api_key[:6]}...{api_key[-4:]}")
        print(f"API Secret length: {len(api_secret)}")
        
        # 测试snapshots endpoint
        headers = {
            'APCA-API-KEY-ID': api_key,
            'APCA-API-SECRET-KEY': api_secret
        }
        
        url = f'https://data.alpaca.markets/v2/stocks/snapshots?symbols={symbol}'
        print(f"Request URL: {url}")
        
        response = requests.get(url, headers=headers, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response keys: {list(data.keys())}")
            if symbol.upper() in data:
                snapshot = data[symbol.upper()]
                print(f"\nSnapshot data for {symbol}:")
                print(f"Latest Trade: {snapshot.get('latestTrade', {}).get('p')}")
                print(f"Latest Quote bid: {snapshot.get('latestQuote', {}).get('bp')}")
                print(f"Latest Quote ask: {snapshot.get('latestQuote', {}).get('ap')}")
                print(f"Daily Bar: {snapshot.get('dailyBar', {}).get('c')}")
                print(f"Prev Daily Bar: {snapshot.get('prevDailyBar', {}).get('c')}")
            else:
                print(f"{symbol} not in response")
        else:
            print(f"Error: {response.text[:200]}")
            
    except Exception as e:
        print(f"Direct API error: {e}")
    
    print("\n" + "=" * 80)
    print("Test Complete")

if __name__ == "__main__":
    test_direct_alpaca()