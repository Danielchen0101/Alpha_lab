#!/usr/bin/env python3
"""
配置AI API密钥
"""

import requests
import json

def configure_ai():
    """配置AI API密钥"""
    print("Configuring AI API Key")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    
    # DeepSeek API密钥
    ai_config = {
        "provider": "DeepSeek",
        "apiKey": "sk-83365246617844178bf8d1e121b7279f",
        "baseUrl": "https://api.deepseek.com",
        "model": "deepseek-chat"
    }
    
    print(f"AI Configuration to save:")
    print(f"  Provider: {ai_config['provider']}")
    print(f"  API Key: {ai_config['apiKey'][:10]}...{ai_config['apiKey'][-4:]}")
    print(f"  Base URL: {ai_config['baseUrl']}")
    print(f"  Model: {ai_config['model']}")
    
    # 1. 保存AI配置
    print(f"\n1. Saving AI configuration...")
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/provider/config",
            json=ai_config,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Response: {result}")
            print("AI configuration saved successfully")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    # 2. 验证AI配置
    print(f"\n2. Verifying AI configuration...")
    
    try:
        response = requests.get(
            f"{base_url}/api/ai/provider/config",
            timeout=5
        )
        
        if response.status_code == 200:
            config = response.json()
            print(f"AI Config Status: 200 OK")
            print(f"  Provider: {config.get('provider')}")
            print(f"  API Key configured: {'Yes' if config.get('apiKey') else 'No'}")
            print(f"  Base URL: {config.get('baseUrl')}")
            print(f"  Model: {config.get('model')}")
            
            if config.get('apiKey'):
                print("\n  SUCCESS: AI API key is now configured!")
            else:
                print("\n  WARNING: AI API key is still not configured")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    # 3. 测试AI分析
    print(f"\n3. Testing AI analysis with configured API key...")
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": "AAPL"},
            timeout=15
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nAI Analysis Result:")
            print(f"  Success: {result.get('success')}")
            print(f"  Trend: {result.get('trend')}")
            print(f"  Market Data Source: {result.get('provenance', {}).get('marketData')}")
            print(f"  AI Analysis Source: {result.get('provenance', {}).get('aiAnalysis')}")
            print(f"  Message: {result.get('message')}")
            
            # 检查是否使用DeepSeek
            if result.get('provenance', {}).get('aiAnalysis') == 'deepseek':
                print("\n  SUCCESS: AI analysis is now using DeepSeek API!")
            else:
                print(f"\n  WARNING: AI analysis source: {result.get('provenance', {}).get('aiAnalysis')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 80)
    print("Configuration Complete")

if __name__ == "__main__":
    configure_ai()