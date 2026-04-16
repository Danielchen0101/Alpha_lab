#!/usr/bin/env python3
"""
测试调试信息：查看AI分析收到的实际数据
"""

import requests
import json

def test_debug_info():
    """测试调试信息"""
    print("Testing Debug Info for AI Analysis")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    symbol = "AAPL"
    
    # 发送AI分析请求
    print(f"\n1. Sending AI Analysis request for {symbol}...")
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": symbol},
            timeout=15
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            print(f"\nAI Analysis Result:")
            print(f"  Trend: {result.get('trend')}")
            print(f"  Overall Score: {result.get('overallScore')}")
            print(f"  Confidence: {result.get('confidence')}")
            
            # 检查AI推理
            ai_reasoning = result.get('aiReasoning', '')
            if ai_reasoning:
                print(f"\nAI Reasoning (first 500 chars):")
                print(f"{ai_reasoning[:500]}...")
                
                # 检查是否提到$0.00
                if '$0.00' in ai_reasoning or 'zero volume' in ai_reasoning.lower():
                    print("\n❌ PROBLEM: AI still sees $0.00 / zero volume!")
                elif '259' in ai_reasoning or 'price' in ai_reasoning.lower():
                    print("\n✅ POSSIBLE FIX: AI may see real price data")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    # 2. 检查后端控制台输出（通过模拟请求查看日志）
    print(f"\n2. Checking backend console output...")
    print("(Note: Actual console output would show debug prints)")
    
    # 3. 直接测试市场数据
    print(f"\n3. Direct market data test...")
    
    try:
        response = requests.get(
            f"{base_url}/api/market/stocks",
            params={"symbols": symbol},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('stocks'):
                stock = result['stocks'][0]
                print(f"\nMarket Data from snapshots:")
                print(f"  Price: ${stock.get('price')}")
                print(f"  Change %: {stock.get('changePercent')}%")
                print(f"  Volume: {stock.get('volume')}")
                print(f"  Data Source: {stock.get('dataSource')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 80)
    print("Test Complete")

if __name__ == "__main__":
    test_debug_info()