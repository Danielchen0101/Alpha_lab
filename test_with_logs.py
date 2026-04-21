#!/usr/bin/env python3
"""
测试并查看日志
"""

import requests
import json
import time

def test_and_see_logs():
    """测试并查看可能的日志输出"""
    print("Testing AI analysis and checking logs...")
    print("=" * 70)
    
    base_url = "http://127.0.0.1:8889"
    
    # 1. 首先保存一个有效的API密钥
    print("\n1. Setting up API key...")
    
    # 使用之前保存的密钥
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
        print(f"   Config save status: {response.status_code}")
    except Exception as e:
        print(f"   Error: {e}")
    
    # 2. 测试AI分析
    print("\n2. Testing AI analysis (this will show logs in backend console)...")
    print("   Sending request to /api/ai/analyze/single for AAPL")
    print("   Check the backend console for detailed logs!")
    
    try:
        start_time = time.time()
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": "AAPL"},
            timeout=20  # 长超时以查看日志
        )
        elapsed = time.time() - start_time
        
        print(f"\n   Response received after {elapsed:.2f}s")
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n   ✅ SUCCESS! Analysis completed")
            print(f"   - Symbol: {result.get('symbol')}")
            print(f"   - Trend: {result.get('trend')}")
            print(f"   - Overall Score: {result.get('overallScore')}")
            print(f"   - Confidence: {result.get('confidence')}")
            
            # 检查数据来源
            provenance = result.get('provenance', {})
            print(f"\n   Data Provenance:")
            for key, value in provenance.items():
                print(f"   - {key}: {value}")
                
        else:
            print(f"\n   ❌ ERROR: {response.text}")
            
    except requests.exceptions.Timeout:
        print(f"\n   ⏱️  Timeout after 20s")
    except Exception as e:
        print(f"\n   ❌ Exception: {e}")
    
    # 3. 测试新闻
    print("\n3. Testing news interface...")
    
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
        else:
            print(f"   Error: {response.text}")
            
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n" + "=" * 70)
    print("Test completed.")
    print("\nIMPORTANT: Check the backend console for detailed logs!")
    print("The logs will show:")
    print("1. Whether API key was detected as valid")
    print("2. Whether real AI was called or local rules were used")
    print("3. What data sources were used (Alpaca/Finnhub)")
    print("4. Any errors that occurred")

if __name__ == "__main__":
    test_and_see_logs()