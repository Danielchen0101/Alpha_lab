#!/usr/bin/env python3
"""
测试AI配置保存和读取
"""

import requests
import json
import time

def test_ai_config_save_load():
    """测试AI配置保存和读取"""
    print("=== Testing AI Configuration Save/Load ===")
    
    base_url = "http://127.0.0.1:8889"
    
    # 1. 首先读取当前配置
    print("\n1. Reading current AI config...")
    try:
        response = requests.get(f"{base_url}/api/ai/provider/config", timeout=5)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            current_config = response.json()
            print(f"   Current config: {json.dumps(current_config, indent=2)}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error reading config: {e}")
    
    # 2. 保存新的AI配置
    print("\n2. Saving new AI config...")
    new_config = {
        "provider": "DeepSeek",
        "apiKey": "sk-test-key-1234567890",  # 测试API密钥
        "baseUrl": "https://api.deepseek.com",
        "model": "deepseek-chat"
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/provider/config",
            json=new_config,
            timeout=5
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"   Save result: {json.dumps(result, indent=2)}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error saving config: {e}")
    
    # 3. 再次读取配置验证
    print("\n3. Reading config again to verify...")
    try:
        response = requests.get(f"{base_url}/api/ai/provider/config", timeout=5)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            saved_config = response.json()
            print(f"   Saved config: {json.dumps(saved_config, indent=2)}")
            
            # 验证配置是否正确保存
            if saved_config.get('success') and saved_config.get('config'):
                config = saved_config['config']
                print(f"\n   Verification:")
                print(f"   - Provider: {config.get('provider')} (expected: DeepSeek)")
                print(f"   - API Key: {config.get('apiKey')[:10]}... (expected: sk-test-key-1234567890)")
                print(f"   - Base URL: {config.get('baseURL')} (expected: https://api.deepseek.com)")
                print(f"   - Model: {config.get('model')} (expected: deepseek-chat)")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error reading config: {e}")
    
    # 4. 测试AI分析接口
    print("\n4. Testing AI analysis interface...")
    test_symbol = "AAPL"
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": test_symbol},
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            analysis_result = response.json()
            print(f"   Analysis result keys: {list(analysis_result.keys())}")
            
            # 检查关键字段
            print(f"\n   Key fields check:")
            print(f"   - Success: {analysis_result.get('success')}")
            print(f"   - Symbol: {analysis_result.get('symbol')}")
            print(f"   - Trend: {analysis_result.get('trend')}")
            print(f"   - Overall Score: {analysis_result.get('overallScore')}")
            print(f"   - Confidence: {analysis_result.get('confidence')}")
            print(f"   - AI Reasoning: {analysis_result.get('aiReasoning', 'Not found')[:80]}...")
            print(f"   - News Sentiment: {analysis_result.get('newsSentiment')}")
            print(f"   - Event Risk: {analysis_result.get('eventRisk')}")
            print(f"   - Top News: {'Found' if analysis_result.get('topNews') else 'Not found'}")
            
            # 检查数据来源
            provenance = analysis_result.get('provenance', {})
            print(f"\n   Data provenance:")
            print(f"   - Market Data: {provenance.get('marketData')}")
            print(f"   - Company Info: {provenance.get('companyInfo')}")
            print(f"   - News: {provenance.get('news')}")
            print(f"   - AI Analysis: {provenance.get('aiAnalysis')}")
            
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error analyzing stock: {e}")
    
    # 5. 测试新闻接口
    print("\n5. Testing news interface...")
    try:
        response = requests.get(
            f"{base_url}/api/market/news/{test_symbol}",
            timeout=10
        )
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            news_result = response.json()
            print(f"   News result keys: {list(news_result.keys())}")
            
            print(f"\n   News check:")
            print(f"   - Success: {news_result.get('success')}")
            print(f"   - Symbol: {news_result.get('symbol')}")
            print(f"   - News Count: {news_result.get('newsCount')}")
            print(f"   - Source: {news_result.get('source')}")
            print(f"   - Has News: {news_result.get('hasNews')}")
            print(f"   - Sentiment: {news_result.get('sentiment')}")
            print(f"   - Event Risk: {news_result.get('eventRisk')}")
            print(f"   - Top News: {'Found' if news_result.get('topNews') else 'Not found'}")
            
            if news_result.get('topNews'):
                top_news = news_result['topNews']
                print(f"\n   Top News details:")
                print(f"   - Title: {top_news.get('title', 'No title')[:60]}...")
                print(f"   - Source: {top_news.get('source', 'Unknown')}")
                print(f"   - Provider: {top_news.get('provider', 'Unknown')}")
        else:
            print(f"   Error: {response.text}")
    except Exception as e:
        print(f"   Error getting news: {e}")

def main():
    print("Starting AI configuration and data flow test...")
    print("=" * 60)
    
    test_ai_config_save_load()
    
    print("\n" + "=" * 60)
    print("Test completed. Check backend logs for detailed information.")

if __name__ == "__main__":
    main()