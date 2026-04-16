#!/usr/bin/env python3
"""
测试Alpaca函数：比较单只股票和批量接口
"""

import requests
import json

def test_alpaca_functions():
    """测试Alpaca函数"""
    print("Testing Alpaca Functions: Single vs Batch")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    symbol = "AAPL"
    
    # 1. 测试批量接口（UI使用的）
    print(f"\n1. Testing Batch Interface (used by UI)...")
    
    try:
        response = requests.get(
            f"{base_url}/api/market/stocks",
            params={"symbols": symbol},
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Source: {result.get('source')}")
            print(f"Count: {result.get('count')}")
            
            if result.get('stocks'):
                stock = result['stocks'][0]
                print(f"\nBatch Result:")
                print(f"  Price: ${stock.get('price')}")
                print(f"  Change %: {stock.get('changePercent')}%")
                print(f"  Volume: {stock.get('volume')}")
                print(f"  Day High: {stock.get('dayHigh')}")
                print(f"  Day Low: {stock.get('dayLow')}")
                print(f"  Data Source: {stock.get('dataSource')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    # 2. 测试单只股票接口（AI使用的）
    print(f"\n2. Testing Single Stock Interface (used by AI)...")
    
    try:
        response = requests.get(
            f"{base_url}/api/market/stock/{symbol}",
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            stock = response.json()
            print(f"\nSingle Stock Result:")
            print(f"  Success: {stock.get('success')}")
            print(f"  Price: ${stock.get('price')}")
            print(f"  Change %: {stock.get('changePercent')}%")
            print(f"  Volume: {stock.get('volume')}")
            print(f"  Data Source: {stock.get('dataSource')}")
            print(f"  Error: {stock.get('error')}")
            
            # 检查后端日志
            print(f"\nBackend Log Info:")
            print(f"  Response Time: {stock.get('responseTime')}s")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    # 3. 直接检查后端日志
    print(f"\n3. Checking Backend Logs for Alpaca Calls...")
    
    # 让我们看看后端是否记录了Alpaca调用
    print("Checking /api/status for Alpaca status...")
    
    try:
        response = requests.get(f"{base_url}/api/status", timeout=5)
        if response.status_code == 200:
            status = response.json()
            print(f"Alpaca Status: {status.get('alpaca', {}).get('status')}")
            print(f"Alpaca Environment: {status.get('alpaca', {}).get('environment')}")
    except Exception as e:
        print(f"Error: {e}")
    
    # 4. 测试AI分析，查看market_data
    print(f"\n4. Testing AI Analysis with Debug Info...")
    
    try:
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": symbol, "debug": True},
            timeout=15
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            # 检查调试信息
            if 'debug' in result:
                debug_info = result['debug']
                print(f"\nDebug Info:")
                print(f"  Has Market Data: {bool(debug_info.get('market_data'))}")
                print(f"  Market Data Keys: {list(debug_info.get('market_data', {}).keys()) if debug_info.get('market_data') else 'None'}")
                print(f"  Has Company Info: {bool(debug_info.get('company_info'))}")
                print(f"  Has News Data: {bool(debug_info.get('news_data'))}")
                
                # 检查API密钥
                api_check = debug_info.get('api_key_check', {})
                print(f"\nAPI Key Check:")
                print(f"  Has API Key: {api_check.get('has_api_key')}")
                print(f"  API Key Length: {api_check.get('api_key_length')}")
                print(f"  Environment: {api_check.get('environment')}")
                
                # 显示market_data内容
                market_data = debug_info.get('market_data')
                if market_data:
                    print(f"\nMarket Data Content:")
                    for key, value in market_data.items():
                        if key in ['price', 'changePercent', 'volume', 'dayHigh', 'dayLow', 'previousClose']:
                            print(f"  {key}: {value}")
            else:
                print("No debug info available")
                
            # 检查数据来源
            provenance = result.get('provenance', {})
            print(f"\nData Provenance:")
            print(f"  Market Data: {provenance.get('marketData')}")
            print(f"  AI Analysis: {provenance.get('aiAnalysis')}")
            
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 80)
    print("Analysis Complete")

if __name__ == "__main__":
    test_alpaca_functions()