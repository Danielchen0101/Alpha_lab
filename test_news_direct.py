#!/usr/bin/env python3
"""
直接测试新闻API
"""

import requests
import json

def test_news_direct():
    """直接测试新闻API"""
    print("Direct Testing News API")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    
    # 测试多个端点
    endpoints = [
        "/api/market/news/AAPL",
        "/market/news/AAPL",
        "/api/market/news/MSFT",
        "/market/news/MSFT"
    ]
    
    for endpoint in endpoints:
        print(f"\nTesting endpoint: {endpoint}")
        
        try:
            response = requests.get(
                f"{base_url}{endpoint}",
                timeout=10
            )
            
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text[:200]}...")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"JSON parsed successfully")
                    print(f"Success: {data.get('success')}")
                    print(f"Message: {data.get('message')}")
                except:
                    print(f"Response is not JSON")
            else:
                print(f"Error status: {response.status_code}")
                
        except Exception as e:
            print(f"Error: {e}")
    
    print(f"\n{'='*80}")
    print("Test Complete")

if __name__ == "__main__":
    test_news_direct()