#!/usr/bin/env python3
"""
简单测试
"""

import requests
import json

def test():
    """测试"""
    base_url = "http://127.0.0.1:8889"
    
    try:
        response = requests.get(f"{base_url}/api/market/stock/AAPL", timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success')}")
            print(f"Data source: {data.get('dataSource')}")
            print(f"Price: {data.get('price')}")
            print(f"Change %: {data.get('changePercent')}")
        else:
            print(f"Error: {response.text[:500]}")
            
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    test()