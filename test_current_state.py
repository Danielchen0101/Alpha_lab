#!/usr/bin/env python3
"""
测试当前状态：验证AI分析、新闻、成交量、风险等字段的实际来源
"""

import requests
import json
import time

def test_current_state():
    """测试当前状态"""
    print("Testing Current State of AI Analysis")
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
    
    # 2. 测试每个符号的AI分析
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
                print(f"  Company Name: {result.get('companyName')}")
                print(f"  Sector: {result.get('sector')}")
                
                # 检查provenance
                provenance = result.get('provenance', {})
                print(f"\nData Provenance:")
                print(f"  Market Data: {provenance.get('marketData')}")
                print(f"  Company Info: {provenance.get('companyInfo')}")
                print(f"  News: {provenance.get('news')}")
                print(f"  AI Analysis: {provenance.get('aiAnalysis')}")
                
                # 检查AI推理
                ai_reasoning = result.get('aiReasoning', '')
                if ai_reasoning:
                    print(f"\nAI Reasoning (first 200 chars):")
                    print(f"{ai_reasoning[:200]}...")
                    
                    # 分析推理内容
                    if 'local rules' in ai_reasoning.lower() or 'unavailable' in ai_reasoning.lower():
                        print("❌ AI Reasoning is from local rules or unavailable")
                    elif '$0.00' in ai_reasoning:
                        print("❌ AI sees $0.00 data")
                    else:
                        print("✅ AI Reasoning appears to be from real analysis")
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
                    top_news = news_result.get('topNews')
                    if top_news:
                        print(f"  Top News: {top_news.get('title', 'N/A')[:50]}...")
                else:
                    print("❌ News API returned no data or failed")
            else:
                print(f"Error: {response.text}")
                
        except Exception as e:
            print(f"Error testing news: {e}")
        
        # 4. 测试市场数据
        print(f"\n4. Testing Market Data for {symbol}...")
        
        try:
            response = requests.get(
                f"{base_url}/api/market/stocks",
                params={"symbols": symbol},
                timeout=10
            )
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                market_result = response.json()
                if market_result.get('stocks') and len(market_result['stocks']) > 0:
                    stock = market_result['stocks'][0]
                    print(f"Market Data:")
                    print(f"  Price: ${stock.get('price')}")
                    print(f"  Change %: {stock.get('changePercent')}%")
                    print(f"  Volume: {stock.get('volume'):,}")
                    print(f"  Data Source: {stock.get('dataSource')}")
                    
                    # 检查是否有averageVolume
                    if 'averageVolume' in stock:
                        print(f"  Average Volume: {stock.get('averageVolume'):,}")
                        volume_ratio = stock.get('volume', 0) / stock.get('averageVolume', 1) if stock.get('averageVolume', 0) > 0 else 0
                        print(f"  Volume Ratio: {volume_ratio:.2f}x")
                    else:
                        print("❌ No averageVolume data available")
                else:
                    print("❌ No market data returned")
            else:
                print(f"Error: {response.text}")
                
        except Exception as e:
            print(f"Error testing