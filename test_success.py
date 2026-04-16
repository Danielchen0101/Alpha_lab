#!/usr/bin/env python3
"""
测试AI分析成功
"""

import requests
import json

def test_ai_analysis():
    """测试AI分析"""
    print("Testing AI analysis...")
    
    base_url = "http://127.0.0.1:8889"
    
    try:
        # 测试AI分析
        print("\n1. Testing AI analysis for AAPL...")
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": "AAPL"},
            timeout=15
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("\nSUCCESS! Analysis completed")
            print(f"Success: {result.get('success')}")
            print(f"Symbol: {result.get('symbol')}")
            print(f"Trend: {result.get('trend')}")
            print(f"Overall Score: {result.get('overallScore')}")
            print(f"Confidence: {result.get('confidence')}")
            print(f"AI Reasoning: {result.get('aiReasoning', 'Not found')[:100]}...")
            
            # 检查数据来源
            provenance = result.get('provenance', {})
            print(f"\nData Provenance:")
            print(f"Market Data: {provenance.get('marketData')}")
            print(f"Company Info: {provenance.get('companyInfo')}")
            print(f"News: {provenance.get('news')}")
            print(f"AI Analysis: {provenance.get('aiAnalysis')}")
            
            # 检查是否调用了真实AI
            if provenance.get('aiAnalysis') == 'deepseek':
                print("\nREAL AI CALL: Used DeepSeek API")
            elif provenance.get('aiAnalysis') == 'local_rules':
                print("\nLOCAL RULES: Used local rule-based analysis")
            else:
                print(f"\nUNKNOWN: AI source: {provenance.get('aiAnalysis')}")
                
        else:
            print(f"\nError: {response.text}")
            
    except Exception as e:
        print(f"\nException: {e}")

def test_news():
    """测试新闻"""
    print("\n2. Testing news for AAPL...")
    
    base_url = "http://127.0.0.1:8889"
    
    try:
        response = requests.get(
            f"{base_url}/api/market/news/AAPL",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nNews result:")
            print(f"Success: {result.get('success')}")
            print(f"Source: {result.get('source')}")
            print(f"News Count: {result.get('newsCount')}")
            print(f"Has News: {result.get('hasNews')}")
            print(f"Message: {result.get('message')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

def main():
    print("=" * 60)
    print("Testing AI Analysis Success")
    print("=" * 60)
    
    test_ai_analysis()
    test_news()
    
    print("\n" + "=" * 60)
    print("Test completed")

if __name__ == "__main__":
    main()