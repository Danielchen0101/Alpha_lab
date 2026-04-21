#!/usr/bin/env python3
"""
快速测试：查看AI分析的调试输出
"""

import requests
import json

def quick_test():
    """快速测试"""
    print("Quick Test: AI Analysis Debug Output")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    symbol = "AAPL"
    
    # 先配置AI
    print(f"\n1. Configuring AI...")
    
    ai_config = {
        "provider": "DeepSeek",
        "apiKey": "sk-83365246617844178bf8d1e121b7279f",
        "baseUrl": "https://api.deepseek.com",
        "model": "deepseek-chat"
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/provider/config",
            json=ai_config,
            timeout=10
        )
        
        print(f"AI config status: {response.status_code}")
        
        # 测试AI分析
        print(f"\n2. Testing AI analysis for {symbol}...")
        
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": symbol},
            timeout=15
        )
        
        print(f"AI analysis status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nAI Analysis Result:")
            print(f"  Trend: {result.get('trend')}")
            print(f"  Overall Score: {result.get('overallScore')}")
            print(f"  Confidence: {result.get('confidence')}")
            
            ai_reasoning = result.get('aiReasoning', '')
            if ai_reasoning:
                print(f"\nAI Reasoning (first 400 chars):")
                print(f"{ai_reasoning[:400]}...")
                
                if '$0.00' in ai_reasoning:
                    print("\n❌ AI sees $0.00")
                elif '259' in ai_reasoning or 'price' in ai_reasoning.lower():
                    print("\n✅ AI sees real price data")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 80)
    print("Test Complete")

if __name__ == "__main__":
    quick_test()