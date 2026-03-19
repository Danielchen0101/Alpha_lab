#!/usr/bin/env python3
"""
测试修复后的历史数据API
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8889/api"

def test_history_api():
    """测试历史数据API"""
    print("=== Testing Fixed History API ===")
    
    symbol = "AAPL"
    
    # 测试不同时间框架
    timeframes = [
        ('1D', '5min', '1day'),
        ('1W', '1day', '1week'),
        ('1M', '1day', '1month'),
        ('3M', '1day', '3month'),
        ('1Y', '1day', '1year'),
    ]
    
    for timeframe_name, interval, range_param in timeframes:
        print(f"\n--- Timeframe: {timeframe_name} ---")
        
        url = f"{BASE_URL}/market/history/{symbol}"
        params = {
            'interval': interval,
            'range': range_param
        }
        
        try:
            response = requests.get(url, params=params, timeout=30)
            
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"Source: {data.get('dataSource', 'Unknown')}")
                print(f"Data points: {data.get('count', 0)}")
                print(f"Interval: {data.get('interval')}")
                print(f"Range: {data.get('range')}")
                
                if data.get('data') and len(data['data']) > 0:
                    first = data['data'][0]
                    last = data['data'][-1]
                    print(f"Date range: {first.get('time')} to {last.get('time')}")
                    print(f"First data: Open={first.get('open'):.2f}, Close={first.get('close'):.2f}")
                    print(f"Last data: Open={last.get('open'):.2f}, Close={last.get('close'):.2f}")
            elif response.status_code == 404:
                print(f"Error: {response.json().get('error', 'Not found')}")
            else:
                print(f"Error: {response.text[:200]}")
                
        except Exception as e:
            print(f"Request error: {e}")

def test_real_time_api():
    """测试实时数据API"""
    print("\n=== Testing Real-time API ===")
    
    # 测试单个股票
    symbol = "AAPL"
    url = f"{BASE_URL}/market/stock/{symbol}"
    
    try:
        response = requests.get(url, timeout=10)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Source: {data.get('dataSource', 'Unknown')}")
            print(f"Symbol: {data.get('symbol')}")
            print(f"Price: ${data.get('price'):.2f}")
            print(f"Change: {data.get('change'):.2f} ({data.get('changePercent'):.2f}%)")
            print(f"Market Cap: ${data.get('marketCap'):,.0f}M")
        else:
            print(f"Error: {response.text[:200]}")
            
    except Exception as e:
        print(f"Request error: {e}")

if __name__ == "__main__":
    # 首先需要启动后端服务器
    print("NOTE: Make sure backend is running on port 8889")
    print("Run: python start_quant_backend.py")
    print("\n" + "="*50)
    
    # 测试API
    test_history_api()
    test_real_time_api()