#!/usr/bin/env python3
"""
测试市场数据
"""

import requests
import json

def test_market_data():
    """测试市场数据"""
    print("Testing market data...")
    
    base_url = "http://127.0.0.1:8889"
    
    try:
        # 测试市场数据
        print("\n1. Testing market data for AAPL...")
        response = requests.get(
            f"{base_url}/api/market/stock/AAPL",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nMarket data result:")
            print(f"Success: {result.get('success')}")
            
            if result.get('success'):
                stock_data = result.get('stock', {})
                print(f"Price: {stock_data.get('price')}")
                print(f"Change %: {stock_data.get('changePercent')}")
                print(f"Volume: {stock_data.get('volume')}")
                print(f"High: {stock_data.get('high')}")
                print(f"Low: {stock_data.get('low')}")
                print(f"Company Name: {stock_data.get('companyName')}")
                print(f"Sector: {stock_data.get('sector')}")
                
                # 检查数据来源
                sources = result.get('sources', {})
                print(f"\nData Sources:")
                print(f"Market Data: {sources.get('marketData')}")
                print(f"Company Info: {sources.get('companyInfo')}")
            else:
                print(f"Error: {result.get('error')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

def test_alpaca_connectivity():
    """测试Alpaca连接性"""
    print("\n2. Testing Alpaca connectivity...")
    
    base_url = "http://127.0.0.1:8889"
    
    try:
        response = requests.get(
            f"{base_url}/api/status",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nSystem status:")
            print(f"Status: {result.get('status')}")
            print(f"Alpaca: {result.get('alpaca', {}).get('status')}")
            print(f"Finnhub: {result.get('finnhub', {}).get('status')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

def main():
    print("=" * 60)
    print("Testing Market Data and Connectivity")
    print("=" * 60)
    
    test_market_data()
    test_alpaca_connectivity()
    
    print("\n" + "=" * 60)
    print("Test completed")

if __name__ == "__main__":
    main()