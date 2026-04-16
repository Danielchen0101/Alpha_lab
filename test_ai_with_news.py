#!/usr/bin/env python3
"""
测试AI分析中的新闻数据
"""

import requests
import json

def test_ai_with_news():
    """测试AI分析中的新闻数据"""
    print("Testing AI Analysis with News Data")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    symbols = ["AAPL", "MSFT", "TSLA", "GOOGL"]
    
    for symbol in symbols:
        print(f"\n{'='*60}")
        print(f"Testing AI Analysis for {symbol}")
        print(f"{'='*60}")
        
        try:
            response = requests.post(
                f"{base_url}/api/ai/analyze/single",
                json={"symbol": symbol},
                timeout=15
            )
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"\nAI Analysis Result for {symbol}:")
                print(f"  Trend: {result.get('trend')}")
                print(f"  Overall Score: {result.get('overallScore')}")
                print(f"  Confidence: {result.get('confidence')}")
                print(f"  News Sentiment: {result.get('newsSentiment')}")
                print(f"  Event Risk: {result.get('eventRisk')}")
                print(f"  Company Name: {result.get('companyName')}")
                print(f"  Sector: {result.get('sector')}")
                
                # 检查provenance
                provenance = result.get('provenance', {})
                print(f"\nData Provenance:")
                print(f"  Market Data: {provenance.get('marketData')}")
                print(f"  Company Info: {provenance.get('companyInfo')}")
                print(f"  News: {provenance.get('news')}")
                print(f"  AI Analysis: {provenance.get('aiAnalysis')}")
                
                # 检查AI推理
                ai_reasoning = result.get('aiReasoning', '')
                if ai_reasoning:
                    print(f"\nAI Reasoning (first 300 chars):")
                    print(f"{ai_reasoning[:300]}...")
                    
                    # 检查是否提到新闻
                    if 'news' in ai_reasoning.lower() or 'earnings' in ai_reasoning.lower():
                        print("✅ AI reasoning mentions news/earnings")
                    else:
                        print("⚠️  AI reasoning doesn't mention news")
            else:
                print(f"Error: {response.text}")
                
        except Exception as e:
            print(f"Error: {e}")
    
    print(f"\n{'='*80}")
    print("Test Complete")
    print("\nExpected Results:")
    print("1. AAPL: News Sentiment=Positive, Event Risk=Low")
    print("2. MSFT: News Sentiment=Positive, Event Risk=Low")
    print("3. TSLA: News Sentiment=Mixed, Event Risk=Medium")
    print("4. GOOGL: News Sentiment=Neutral, Event Risk=Low")

if __name__ == "__main__":
    test_ai_with_news()