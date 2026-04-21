#!/usr/bin/env python3
"""
调试UI数据：获取AAPL主表显示的真实market data
"""

import requests
import json

def debug_ui_data():
    """调试UI数据"""
    print("Debugging UI Market Data for AAPL")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    symbol = "AAPL"
    
    # 获取UI显示的数据
    print(f"\n1. Getting UI Display Data for {symbol}...")
    
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
                print(f"\nUI Market Data for {symbol}:")
                print(f"  price: {stock.get('price')}")
                print(f"  changePercent: {stock.get('changePercent')}")
                print(f"  volume: {stock.get('volume')}")
                print(f"  dayHigh: {stock.get('dayHigh')}")
                print(f"  dayLow: {stock.get('dayLow')}")
                print(f"  previousClose: {stock.get('previousClose')}")
                print(f"  dataSource: {stock.get('dataSource')}")
                print(f"  sessionType: {stock.get('sessionType')}")
                print(f"  isFallback: {stock.get('isFallback')}")
                
                # 打印所有字段
                print(f"\nAll fields in UI data:")
                for key, value in stock.items():
                    if value is not None:
                        print(f"  {key}: {value}")
            else:
                print("No stock data in response")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    # 2. 测试AI分析，查看输入数据
    print(f"\n2. Testing AI Analysis Input for {symbol}...")
    
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
                market_data = debug_info.get('market_data')
                if market_data:
                    print(f"\nAI Input Market Data (from debug info):")
                    print(f"  Type: {type(market_data)}")
                    print(f"  Keys: {list(market_data.keys())}")
                    print(f"  price: {market_data.get('price')}")
                    print(f"  changePercent: {market_data.get('changePercent')}")
                    print(f"  volume: {market_data.get('volume')}")
                    print(f"  dayHigh: {market_data.get('dayHigh')}")
                    print(f"  dayLow: {market_data.get('dayLow')}")
                    print(f"  previousClose: {market_data.get('previousClose')}")
                    print(f"  dataSource: {market_data.get('dataSource')}")
                else:
                    print("No market_data in debug info")
            else:
                print("No debug info available")
                
            # 检查AI推理
            ai_reasoning = result.get('aiReasoning', '')
            if ai_reasoning:
                print(f"\nAI Reasoning (first 300 chars):")
                print(f"{ai_reasoning[:300]}...")
        else:
            print(f"Error: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n" + "=" * 80)
    print("Debug Complete")

if __name__ == "__main__":
    debug_ui_data()