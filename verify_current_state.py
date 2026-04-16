#!/usr/bin/env python3
"""
验证当前状态：检查AI分析、新闻、成交量、风险等字段的实际来源
"""

import requests
import json
import time

def verify_current_state():
    """验证当前状态"""
    print("Verifying Current State of AI Analysis")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    symbols = ["AAPL", "MSFT", "TSLA"]
    
    # 1. 检查AI配置
    print(f"\n1. Checking AI Configuration...")
    
    try:
        response = requests.get(
            f"{base_url}/api/ai/provider/config",
            timeout=10
        )
        
        if response.status_code == 200:
            config = response.json()
            ai_config = config.get('config', {})
            print(f"AI Config State:")
            print(f"  provider: {ai_config.get('provider')}")
            print(f"  apiKey length: {len(ai_config.get('apiKey', ''))}")
            print(f"  baseURL: {ai_config.get('baseURL')}")
            print(f"  model: {ai_config.get('model')}")
            
            if not ai_config.get('apiKey'):
                print("❌ AI API Key is empty - will use local rules")
            else:
                print("✅ AI API Key is configured")
        else:
            print(f"Error getting AI config: {response.status_code}")
    except Exception as e:
        print(f"Error: {e}")
    
    # 2. 测试每个符号
    for symbol in symbols:
        print(f"\n{'='*60}")
        print(f"Testing {symbol}")
        print(f"{'='*60}")
        
        # 测试AI分析
        print(f"\n2. Testing AI Analysis for {symbol}...")
        
        try:
            response = requests.post(
                f"{base_url}/api/ai/analyze/single",
                json={"symbol": symbol},
                timeout=15
            )
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"\nAI Analysis Result for {symbol}:")
                print(f"  Trend: {result.get('trend')}")
                print(f"  Overall Score: {result.get('overallScore')}")
                print(f"  Confidence: {result.get('confidence')}")
                print(f"  News Sentiment: {result.get('newsSentiment')}")
                print(f"  Event Risk: {result.get('eventRisk')}")
                
                # 检查provenance
                provenance = result.get('provenance', {})
                print(f"\nData Provenance:")
                print(f"  Market Data: {provenance.get('marketData')}")
                print(f"  Company Info: {provenance.get('companyInfo')}")
                print(f"  News: {provenance.get('news')}")
                print(f"  AI Analysis: {provenance.get('aiAnalysis')}")
                
                # 判断是否使用AI
                if provenance.get('aiAnalysis') == 'deepseek':
                    print("✅ Using DeepSeek AI analysis")
                elif provenance.get('aiAnalysis') == 'local_rules':
                    print("❌ Using local rules, not AI")
                else:
                    print(f"⚠️  Unknown AI analysis source: {provenance.get('aiAnalysis')}")
                
                # 检查AI推理
                ai_reasoning = result.get('aiReasoning', '')
                if ai_reasoning:
                    print(f"\nAI Reasoning (first 200 chars):")
                    print(f"{ai_reasoning[:200]}...")
            else:
                print(f"Error: {response.text}")
                
        except Exception as e:
            print(f"Error testing AI analysis: {e}")
        
        # 3. 测试新闻
        print(f"\n3. Testing News for {symbol}...")
        
        try:
            response = requests.get(
                f"{base_url}/api/market/news/{symbol}",
                timeout=10
            )
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                news_result = response.json()
                print(f"News Result:")
                print(f"  Success: {news_result.get('success')}")
                print(f"  News Count: {news_result.get('newsCount', 0)}")
                print(f"  Sentiment: {news_result.get('sentiment')}")
                print(f"  Event Risk: {news_result.get('eventRisk')}")
                
                if news_result.get('success') and news_result.get('newsCount', 0) > 0:
                    print("✅ News API returned data")
                else:
                    print("❌ News API returned no data or failed")
            else:
                print(f"Error: {response.text}")
                
        except Exception as e:
            print(f"Error testing news: {e}")
        
        time.sleep(1)
    
    print(f"\n{'='*80}")
    print("Verification Complete")
    print("\nKey Findings:")
    print("1. Check provenance.aiAnalysis - should be 'deepseek' for real AI")
    print("2. Check if news API returns actual news data")
    print("3. Check if AI reasoning shows real analysis vs template text")

if __name__ == "__main__":
    verify_current_state()