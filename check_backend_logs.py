#!/usr/bin/env python3
"""
检查后端日志：查看AI分析的实际调用
"""

import requests
import json

def check_backend_logs():
    """检查后端日志"""
    print("Checking Backend Logs for AI Analysis")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    symbol = "AAPL"
    
    # 发送AI分析请求，但先检查是否有实时日志
    print(f"\n1. Sending AI Analysis request for {symbol}...")
    
    try:
        # 首先清除可能存在的缓存
        print("Clearing cache...")
        
        # 发送AI分析请求
        print(f"Sending POST to /api/ai/analyze/single...")
        
        response = requests.post(
            f"{base_url}/api/ai/analyze/single",
            json={"symbol": symbol},
            timeout=15
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nResponse received:")
            print(f"  Trend: {result.get('trend')}")
            print(f"  Market Data Source: {result.get('provenance', {}).get('marketData')}")
            print(f"  AI Analysis Source: {result.get('provenance', {}).get('aiAnalysis')}")
            
            # 检查消息
            message = result.get('message', '')
            print(f"  Message: {message}")
            
            # 如果仍然显示finnhub，说明问题在其他地方
            if result.get('provenance', {}).get('marketData') == 'finnhub':
                print("\nPROBLEM: AI analysis still using Finnhub data!")
                print("Possible reasons:")
                print("1. fetch_alpaca_stock_data_snapshot may be failing")
                print("2. The fix in ai_analyze_single may not be executing")
                print("3. There may be a different code path being used")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    # 2. 直接测试snapshots函数
    print(f"\n2. Directly testing snapshots function...")
    
    try:
        response = requests.get(
            f"{base_url}/api/market/stocks",
            params={"symbols": symbol},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"Snapshots function status: 200 OK")
            if result.get('stocks'):
                stock = result['stocks'][0]
                print(f"  Price: ${stock.get('price')}")
                print(f"  Data Source: {stock.get('dataSource')}")
                
                if stock.get('dataSource') == 'Alpaca':
                    print("  Snapshots function is working correctly")
                else:
                    print(f"  WARNING: Snapshots data source: {stock.get('dataSource')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    # 3. 检查AI配置
    print(f"\n3. Checking AI configuration...")
    
    try:
        response = requests.get(
            f"{base_url}/api/ai/provider/config",
            timeout=5
        )
        
        if response.status_code == 200:
            config = response.json()
            print(f"AI Config Status: 200 OK")
            print(f"  Provider: {config.get('provider')}")
            print(f"  API Key configured: {'Yes' if config.get('apiKey') else 'No'}")
            print(f"  Base URL: {config.get('baseUrl')}")
            print(f"  Model: {config.get('model')}")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 80)
    print("Analysis Complete")

if __name__ == "__main__":
    check_backend_logs()