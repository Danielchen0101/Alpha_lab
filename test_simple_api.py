#!/usr/bin/env python3
"""
简单API测试
"""

import requests
import json

def test_ai_analysis():
    """测试AI分析"""
    print("Testing AI analysis...")
    
    base_url = "http://127.0.0.1:8889"
    
    # 1. 首先确保有API密钥
    print("\n1. Checking AI config...")
    try:
        response = requests.get(f"{base_url}/api/ai/provider/config", timeout=5)
        if response.status_code == 200:
            config = response.json()
            api_key = config.get('config', {}).get('apiKey', '')
            print(f"   API Key: {api_key[:15]}... (length: {len(api_key)})")
        else:
            print(f"   Error getting config: {response.text}")
            return
    except Exception as e:
        print(f"   Error: {e}")
        return
    
    # 2. 测试AI分析
    print("\n2. Testing AI analysis for AAPL...")
    try:
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": "AAPL"},
            timeout=15
        )
        
        print(f"   Status: {response.status_code}")
        print(f"   Response time: {response.elapsed.total_seconds():.2f}s")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n   SUCCESS! Analysis result:")
            print(f"   - Success: {result.get('success')}")
            print(f"   - Symbol: {result.get('symbol')}")
            print(f"   - Trend: {result.get('trend')}")
            print(f"   - Overall Score: {result.get('overallScore')}")
            print(f"   - Confidence: {result.get('confidence')}")
            
            # 检查是否调用了真实AI
            provenance = result.get('provenance', {})
            ai_source = provenance.get('aiAnalysis', '')
            if ai_source == 'deepseek':
                print(f"\n   ✅ REAL AI CALL: Used DeepSeek API")
            elif ai_source == 'local_rules':
                print(f"\n   ⚠️  LOCAL RULES: Used local rule-based analysis")
            else:
                print(f"\n   ❓ UNKNOWN: AI source: {ai_source}")
                
        else:
            print(f"   Error: {response.text}")
            
    except requests.exceptions.Timeout:
        print("   ⏱️  Timeout: Request took too long")
    except Exception as e:
        print(f"   Error: {e}")

def test_news():
    """测试新闻"""
    print("\n3. Testing news for AAPL...")
    
    base_url = "http://127.0.0.1:8889"
    
    try:
        response = requests.get(
            f"{base_url}/api/market/news/AAPL",
            timeout=10
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n   News result:")
            print(f"   - Success: {result.get('success')}")
            print(f"   - Source: {result.get('source')}")
            print(f"   - News Count: {result.get('newsCount')}")
            print(f"   - Has News: {result.get('hasNews')}")
            
            if result.get('hasNews'):
                print(f"   ✅ NEWS FOUND")
            else:
                print(f"   ⚠️  NO NEWS: {result.get('message')}")
        else:
            print(f"   Error: {response.text}")
            
    except Exception as e:
        print(f"   Error: {e}")

def main():
    print("=" * 60)
    print("Simple API Test")
    print("=" * 60)
    
    test_ai_analysis()
    test_news()
    
    print("\n" + "=" * 60)
    print("Test completed")

if __name__ == "__main__":
    main()