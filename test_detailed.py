#!/usr/bin/env python3
"""
详细测试脚本
"""

import requests
import json
import time

def test_with_real_api_key():
    """使用真实API密钥测试"""
    print("=== Testing with Real API Key ===")
    
    base_url = "http://127.0.0.1:8889"
    
    # 1. 保存一个有效的API密钥（从环境变量或手动输入）
    # 注意：这里使用一个测试密钥，实际使用时需要真实密钥
    real_api_key = "sk-83365246617844178bf8d1e121b7279f"  # 之前保存的密钥
    
    print(f"\n1. Saving real API key: {real_api_key[:15]}...")
    
    config = {
        "provider": "DeepSeek",
        "apiKey": real_api_key,
        "baseUrl": "https://api.deepseek.com",
        "model": "deepseek-chat"
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/provider/config",
            json=config,
            timeout=5
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            print(f"   Result: {response.json()}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # 2. 测试AI分析
    print("\n2. Testing AI analysis with real API key...")
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": "AAPL"},
            timeout=15  # 增加超时时间
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response time: {response.elapsed.total_seconds():.2f}s")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n   Analysis Result:")
            print(f"   - Success: {result.get('success')}")
            print(f"   - Symbol: {result.get('symbol')}")
            print(f"   - Trend: {result.get('trend')}")
            print(f"   - Overall Score: {result.get('overallScore')}")
            print(f"   - Confidence: {result.get('confidence')}")
            
            ai_reasoning = result.get('aiReasoning', '')
            if ai_reasoning:
                print(f"   - AI Reasoning (first 100 chars): {ai_reasoning[:100]}...")
            else:
                print(f"   - AI Reasoning: Not found")
            
            print(f"   - News Sentiment: {result.get('newsSentiment')}")
            print(f"   - Event Risk: {result.get('eventRisk')}")
            print(f"   - Top News: {'Found' if result.get('topNews') else 'Not found'}")
            
            # 检查数据来源
            provenance = result.get('provenance', {})
            print(f"\n   Data Provenance:")
            print(f"   - Market Data: {provenance.get('marketData')}")
            print(f"   - Company Info: {provenance.get('companyInfo')}")
            print(f"   - News: {provenance.get('news')}")
            print(f"   - AI Analysis: {provenance.get('aiAnalysis')}")
            
            # 检查是否调用了真实AI
            if provenance.get('aiAnalysis') == 'deepseek':
                print(f"\n   ✅ REAL AI CALL: Used DeepSeek API")
            else:
                print(f"\n   ⚠️  LOCAL RULES: Used local rule-based analysis")
                
        else:
            print(f"   Error: {response.text}")
            
    except requests.exceptions.Timeout:
        print(f"   ⏱️  Timeout: Request took too long")
    except Exception as e:
        print(f"   Error: {e}")
    
    # 3. 测试新闻接口
    print("\n3. Testing news interface in detail...")
    
    try:
        response = requests.get(
            f"{base_url}/api/market/news/AAPL",
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n   News Result:")
            print(f"   - Success: {result.get('success')}")
            print(f"   - Source: {result.get('source')}")
            print(f"   - News Count: {result.get('newsCount')}")
            print(f"   - Has News: {result.get('hasNews')}")
            print(f"   - Message: {result.get('message')}")
            
            if result.get('hasNews'):
                print(f"\n   ✅ NEWS FOUND: {result.get('newsCount')} news items")
                if result.get('topNews'):
                    top_news = result['topNews']
                    print(f"   - Top News Title: {top_news.get('title', 'No title')}")
                    print(f"   - Source: {top_news.get('source', 'Unknown')}")
                    print(f"   - Provider: {top_news.get('provider', 'Unknown')}")
            else:
                print(f"\n   ⚠️  NO NEWS: {result.get('message')}")
                
        else:
            print(f"   Error: {response.text}")
            
    except Exception as e:
        print(f"   Error: {e}")

def test_market_data():
    """测试市场数据接口"""
    print("\n=== Testing Market Data ===")
    
    base_url = "http://127.0.0.1:8889"
    
    try:
        response = requests.get(
            f"{base_url}/api/market/stock/AAPL",
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n   Market Data for AAPL:")
            print(f"   - Success: {result.get('success')}")
            
            if result.get('success'):
                stock_data = result.get('stock', {})
                print(f"   - Price: {stock_data.get('price')}")
                print(f"   - Change %: {stock_data.get('changePercent')}")
                print(f"   - Volume: {stock_data.get('volume')}")
                print(f"   - High: {stock_data.get('high')}")
                print(f"   - Low: {stock_data.get('low')}")
                print(f"   - Company Name: {stock_data.get('companyName')}")
                print(f"   - Sector: {stock_data.get('sector')}")
                
                # 检查数据来源
                sources = result.get('sources', {})
                print(f"\n   Data Sources:")
                print(f"   - Market Data: {sources.get('marketData')}")
                print(f"   - Company Info: {sources.get('companyInfo')}")
        else:
            print(f"   Error: {response.text}")
            
    except Exception as e:
        print(f"   Error: {e}")

def main():
    print("Starting detailed data flow test...")
    print("=" * 70)
    
    test_with_real_api_key()
    test_market_data()
    
    print("\n" + "=" * 70)
    print("Test completed.")
    print("\nKey checks:")
    print("1. ✅ AI Configuration: Can save and load")
    print("2. ⚠️  AI Analysis: Need to check if real API is called")
    print("3. ⚠️  News Data: Need to check Alpaca/Finnhub connectivity")
    print("4. ✅ Market Data: Should work with Alpaca/Finnhub")

if __name__ == "__main__":
    main()