#!/usr/bin/env python3
"""
测试Alpaca真实交易密钥配置
"""

import requests
import json

def test_alpaca_market_data():
    """测试Alpaca市场数据"""
    print("Testing Alpaca real trading key configuration...")
    print("=" * 70)
    
    base_url = "http://127.0.0.1:8889"
    
    # 1. 测试市场数据接口
    print("\n1. Testing market data for AAPL (should use Alpaca)...")
    
    try:
        response = requests.get(
            f"{base_url}/api/market/stock/AAPL",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nMarket data result:")
            print(f"Success: {result.get('success')}")
            print(f"Symbol: {result.get('symbol')}")
            print(f"Price: {result.get('price')}")
            print(f"Change %: {result.get('changePercent')}")
            print(f"Volume: {result.get('volume')}")
            print(f"Day High: {result.get('dayHigh')}")
            print(f"Day Low: {result.get('dayLow')}")
            print(f"Company Name: {result.get('companyName')}")
            print(f"Sector: {result.get('sector')}")
            
            # 检查数据来源
            sources = result.get('sources', {})
            print(f"\nData Sources:")
            print(f"Market Data: {sources.get('marketData')}")
            print(f"Company Info: {sources.get('companyInfo')}")
            
            # 检查是否使用了Alpaca
            if sources.get('marketData') == 'alpaca':
                print("\n✅ MARKET DATA FROM ALPACA: Successfully using real trading key")
            else:
                print(f"\n⚠️  Market data source: {sources.get('marketData')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    # 2. 测试批量股票数据
    print("\n2. Testing batch market data for multiple symbols...")
    
    try:
        response = requests.get(
            f"{base_url}/api/market/stocks",
            params={"symbols": "AAPL,MSFT,GOOGL"},
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nBatch data result:")
            print(f"Success: {result.get('success')}")
            print(f"Source: {result.get('source')}")
            print(f"Count: {result.get('count')}")
            
            if result.get('stocks'):
                stocks = result['stocks']
                print(f"\nStocks data (first 3):")
                for i, stock in enumerate(stocks[:3]):
                    print(f"  {i+1}. {stock.get('symbol')}: ${stock.get('price')} ({stock.get('changePercent')}%)")
                    
                # 检查数据来源
                if result.get('source') == 'alpaca':
                    print("\n✅ BATCH DATA FROM ALPACA: Successfully using real trading key")
                else:
                    print(f"\n⚠️  Batch data source: {result.get('source')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    # 3. 测试AI分析接口
    print("\n3. Testing AI analysis (should use Alpaca data as input)...")
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": "AAPL"},
            timeout=15
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nAI analysis result:")
            print(f"Success: {result.get('success')}")
            print(f"Symbol: {result.get('symbol')}")
            print(f"Trend: {result.get('trend')}")
            print(f"Overall Score: {result.get('overallScore')}")
            print(f"Confidence: {result.get('confidence')}")
            
            # 检查数据来源
            provenance = result.get('provenance', {})
            print(f"\nData Provenance:")
            print(f"Market Data: {provenance.get('marketData')}")
            print(f"Company Info: {provenance.get('companyInfo')}")
            print(f"News: {provenance.get('news')}")
            print(f"AI Analysis: {provenance.get('aiAnalysis')}")
            
            # 检查是否使用了Alpaca作为市场数据输入
            if provenance.get('marketData') == 'alpaca':
                print("\n✅ AI INPUT FROM ALPACA: AI analysis using real Alpaca market data")
            else:
                print(f"\n⚠️  AI input market data source: {provenance.get('marketData')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 70)
    print("Test completed")

if __name__ == "__main__":
    test_alpaca_market_data()