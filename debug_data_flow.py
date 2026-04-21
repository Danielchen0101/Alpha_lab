#!/usr/bin/env python3
"""
调试数据流：比较UI显示数据和AI分析数据
"""

import requests
import json
import time

def debug_data_flow():
    """调试数据流"""
    print("Debugging Data Flow: UI vs AI Analysis")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    symbol = "AAPL"
    
    # 1. 获取UI显示数据（批量接口）
    print(f"\n1. Getting UI Display Data for {symbol} (batch endpoint)...")
    
    try:
        response = requests.get(
            f"{base_url}/api/market/stocks",
            params={"symbols": symbol},
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get('stocks'):
                stock = result['stocks'][0]
                print(f"\nUI Display Data (from batch endpoint):")
                print(f"  Symbol: {stock.get('symbol')}")
                print(f"  Price: ${stock.get('price')}")
                print(f"  Change %: {stock.get('changePercent')}%")
                print(f"  Volume: {stock.get('volume')}")
                print(f"  Day High: {stock.get('dayHigh')}")
                print(f"  Day Low: {stock.get('dayLow')}")
                print(f"  Company Name: {stock.get('companyName')}")
                print(f"  Sector: {stock.get('sector')}")
                print(f"  Data Source: {stock.get('dataSource')}")
            else:
                print("No stock data in response")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    # 2. 获取单只股票数据（可能失败）
    print(f"\n2. Getting Single Stock Data for {symbol} (single endpoint)...")
    
    try:
        response = requests.get(
            f"{base_url}/api/market/stock/{symbol}",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            stock = response.json()
            print(f"\nSingle Stock Data:")
            print(f"  Success: {stock.get('success')}")
            print(f"  Price: ${stock.get('price')}")
            print(f"  Change %: {stock.get('changePercent')}%")
            print(f"  Volume: {stock.get('volume')}")
            print(f"  Error: {stock.get('error')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    # 3. 直接测试fetch_alpaca_stock_data函数（模拟AI分析使用的函数）
    print(f"\n3. Testing fetch_alpaca_stock_data function (used by AI analysis)...")
    
    try:
        # 直接调用后端函数（通过API）
        response = requests.post(
            f"{base_url}/api/debug/alpaca",
            json={"symbol": symbol, "action": "fetch_single"},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nfetch_alpaca_stock_data result:")
            print(f"  Success: {result.get('success')}")
            print(f"  Data: {json.dumps(result.get('data'), indent=2)}")
            print(f"  Error: {result.get('error')}")
        else:
            print(f"Debug endpoint not available: {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
        print("Debug endpoint not available")
    
    # 4. 测试fetch_alpaca_stock_data_snapshot函数（UI使用的函数）
    print(f"\n4. Testing fetch_alpaca_stock_data_snapshot function (used by UI)...")
    
    try:
        response = requests.post(
            f"{base_url}/api/debug/alpaca",
            json={"symbols": [symbol], "action": "fetch_snapshot"},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nfetch_alpaca_stock_data_snapshot result:")
            print(f"  Success: {result.get('success')}")
            print(f"  Data: {json.dumps(result.get('data'), indent=2)}")
            print(f"  Error: {result.get('error')}")
        else:
            print(f"Debug endpoint not available: {response.status_code}")
            
    except Exception as e:
        print(f"Error: {e}")
        print("Debug endpoint not available")
    
    # 5. 测试AI分析实际收到的数据
    print(f"\n5. Testing AI Analysis Input Data for {symbol}...")
    
    try:
        # 首先保存当前时间
        start_time = time.time()
        
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": symbol, "debug": True},
            timeout=15
        )
        
        elapsed = time.time() - start_time
        print(f"Response time: {elapsed:.2f}s")
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nAI Analysis Result:")
            print(f"  Success: {result.get('success')}")
            print(f"  Symbol: {result.get('symbol')}")
            print(f"  Trend: {result.get('trend')}")
            print(f"  Overall Score: {result.get('overallScore')}")
            print(f"  Confidence: {result.get('confidence')}")
            
            # 检查AI推理
            ai_reasoning = result.get('aiReasoning', '')
            if ai_reasoning:
                print(f"\nAI Reasoning (first 200 chars):")
                print(f"  {ai_reasoning[:200]}...")
            
            # 检查数据来源
            provenance = result.get('provenance', {})
            print(f"\nData Provenance:")
            print(f"  Market Data: {provenance.get('marketData')}")
            print(f"  Company Info: {provenance.get('companyInfo')}")
            print(f"  News: {provenance.get('news')}")
            print(f"  AI Analysis: {provenance.get('aiAnalysis')}")
            
            # 检查是否有调试信息
            if 'debug' in result:
                print(f"\nDebug Info:")
                print(f"  Market Data: {json.dumps(result['debug'].get('market_data'), indent=2)}")
                print(f"  Company Info: {json.dumps(result['debug'].get('company_info'), indent=2)}")
                print(f"  News Data: {json.dumps(result['debug'].get('news_data'), indent=2)}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 80)
    print("Analysis Complete")

if __name__ == "__main__":
    debug_data_flow()