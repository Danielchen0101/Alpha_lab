#!/usr/bin/env python3
"""
测试新闻API修复
"""

import requests
import json

def test_news_fix():
    """测试新闻API修复"""
    print("Testing News API Fix")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    symbols = ["AAPL", "MSFT", "TSLA"]
    
    for symbol in symbols:
        print(f"\n{'='*60}")
        print(f"Testing News for {symbol}")
        print(f"{'='*60}")
        
        try:
            response = requests.get(
                f"{base_url}/api/market/news/{symbol}",
                timeout=10
            )
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"Success: {result.get('success')}")
                print(f"Source: {result.get('source')}")
                print(f"News Count: {result.get('newsCount')}")
                print(f"Sentiment: {result.get('sentiment')}")
                print(f"Event Risk: {result.get('eventRisk')}")
                print(f"Has News: {result.get('hasNews')}")
                print(f"Message: {result.get('message')}")
                
                # 检查topNews
                top_news = result.get('topNews')
                if top_news:
                    print(f"\nTop News:")
                    print(f"  Title: {top_news.get('title', 'N/A')[:50]}...")
                    print(f"  Source: {top_news.get('source', 'N/A')}")
                    print(f"  Provider: {top_news.get('provider', 'N/A')}")
                
                # 检查新闻列表
                news_list = result.get('news', [])
                if news_list and len(news_list) > 0:
                    print(f"\nFirst News Item:")
                    first_news = news_list[0]
                    print(f"  Headline: {first_news.get('headline', 'N/A')[:50]}...")
                    print(f"  Source: {first_news.get('source', 'N/A')}")
                    if 'sentiment' in first_news:
                        print(f"  Sentiment: {first_news.get('sentiment', 'N/A')}")
            else:
                print(f"Error: {response.text}")
                
        except Exception as e:
            print(f"Error: {e}")
    
    print(f"\n{'='*80}")
    print("Test Complete")

if __name__ == "__main__":
    test_news_fix()