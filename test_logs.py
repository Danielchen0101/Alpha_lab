#!/usr/bin/env python3
"""
测试并查看后端日志
"""

import requests
import json

def test_ai_analysis_with_logs():
    """测试AI分析并查看日志"""
    print("Testing AI analysis - check backend console for logs!")
    print("=" * 70)
    
    base_url = "http://127.0.0.1:8889"
    
    # 1. 首先确保API密钥已保存
    print("\n1. Ensuring API key is saved...")
    
    config = {
        "provider": "DeepSeek",
        "apiKey": "sk-83365246617844178bf8d1e121b7279f",
        "baseUrl": "https://api.deepseek.com",
        "model": "deepseek-chat"
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/provider/config",
            json=config,
            timeout=5
        )
        print(f"   Config save: {response.status_code}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # 2. 测试AI分析
    print("\n2. Testing AI analysis for AAPL...")
    print("   This will show detailed logs in backend console!")
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": "AAPL"},
            timeout=15
        )
        
        print(f"\n   Response status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n   ✅ SUCCESS! Analysis completed")
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(f"\n   Response body: {response.text}")
            
    except Exception as e:
        print(f"\n   Error: {e}")
    
    print("\n" + "=" * 70)
    print("Check the backend console for detailed logs!")
    print("You should see:")
    print("1. API key check result")
    print("2. Whether real AI was called or local rules used")
    print("3. Market data, news data, company info status")
    print("4. Any errors that occurred")

if __name__ == "__main__":
    test_ai_analysis_with_logs()