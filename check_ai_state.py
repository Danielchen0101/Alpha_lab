#!/usr/bin/env python3
"""
检查AI状态
"""

import requests
import json

def check_ai_state():
    """检查AI状态"""
    print("Checking AI State")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    
    # 1. 检查AI配置
    print(f"\n1. Checking AI Configuration...")
    
    try:
        response = requests.get(
            f"{base_url}/api/ai/provider/config",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            config = response.json()
            ai_config = config.get('config', {})
            print(f"AI Config:")
            print(f"  provider: {ai_config.get('provider')}")
            print(f"  apiKey: {ai_config.get('apiKey', '')[:10]}... (length: {len(ai_config.get('apiKey', ''))})")
            print(f"  baseURL: {ai_config.get('baseURL')}")
            print(f"  model: {ai_config.get('model')}")
            
            # 保存配置用于测试
            api_key = ai_config.get('apiKey', '')
            if not api_key:
                print("\n❌ API Key is empty!")
            else:
                print(f"\n✅ API Key is configured (length: {len(api_key)})")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error: {e}")
    
    # 2. 测试AI分析，添加debug参数
    print(f"\n2. Testing AI Analysis with debug...")
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": "AAPL", "debug": True},
            timeout=15
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nAI Analysis Result:")
            print(f"  Trend: {result.get('trend')}")
            print(f"  Overall Score: {result.get('overallScore')}")
            print(f"  Confidence: {result.get('confidence')}")
            print(f"  News Sentiment: {result.get('newsSentiment')}")
            print(f"  Event Risk: {result.get('eventRisk')}")
            
            # 检查provenance
            provenance = result.get('provenance', {})
            print(f"\nData Provenance:")
            print(f"  AI Analysis: {provenance.get('aiAnalysis')}")
            print(f"  Market Data: {provenance.get('marketData')}")
            print(f"  Company Info: {provenance.get('companyInfo')}")
            print(f"  News: {provenance.get('news')}")
            
            # 检查debug信息
            debug_info = result.get('debug')
            if debug_info:
                print(f"\nDebug Info:")
                api_key_check = debug_info.get('api_key_check', {})
                print(f"  Has API Key: {api_key_check.get('has_api_key')}")
                print(f"  API Key Length: {api_key_check.get('api_key_length')}")
                
                # 检查新闻数据
                news_data = debug_info.get('news_data')
                if news_data:
                    print(f"  News Data: {news_data}")
                else:
                    print(f"  News Data: None or empty")
            else:
                print(f"\nNo debug info available")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    print(f"\n{'='*80}")
    print("Check Complete")

if __name__ == "__main__":
    check_ai_state()