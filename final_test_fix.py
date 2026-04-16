#!/usr/bin/env python3
"""
最终测试修复
"""

import requests
import json

def final_test_fix():
    """最终测试修复"""
    print("Final Test Fix: AI Analysis with Real Data")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    symbol = "AAPL"
    
    # 1. 配置AI
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
        
        # 2. 测试AI分析
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
                print(f"\nAI Reasoning (first 500 chars):")
                print(f"{ai_reasoning[:500]}...")
                
                # 检查是否提到真实数据
                if '$0.00' in ai_reasoning or 'zero volume' in ai_reasoning.lower():
                    print("\n❌ PROBLEM: AI still sees $0.00 / zero volume!")
                elif '259' in ai_reasoning or 'price' in ai_reasoning.lower():
                    print("\n✅ SUCCESS: AI sees real price data!")
                elif 'data missing' in ai_reasoning.lower() or '数据缺失' in ai_reasoning:
                    print("\n⚠️  WARNING: AI reports missing data")
                else:
                    print("\nℹ️  INFO: AI reasoning doesn't mention specific price")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 80)
    print("Test Complete")

if __name__ == "__main__":
    final_test_fix()