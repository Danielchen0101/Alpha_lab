#!/usr/bin/env python3
"""
测试API接口
"""

import requests
import json
import time

def test_market_stocks():
    """测试 /api/market/stocks 接口"""
    url = "http://127.0.0.1:8889/api/market/stocks"
    
    print(f"测试 {url}...")
    start_time = time.time()
    
    try:
        response = requests.get(url, timeout=15)
        elapsed = time.time() - start_time
        
        print(f"响应时间: {elapsed:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"股票数量: {data.get('count', 0)}")
            print(f"数据源: {data.get('source', 'unknown')}")
            
            stocks = data.get('stocks', [])
            if stocks:
                print(f"\n前3个股票:")
                for i, stock in enumerate(stocks[:3]):
                    print(f"  {i+1}. {stock.get('symbol')}: ${stock.get('price')} ({stock.get('changePercent', 0)}%)")
        else:
            print(f"响应内容: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        print(f"请求超时 (>{time.time()-start_time:.1f}秒)")
    except requests.exceptions.ConnectionError:
        print("连接错误")
    except Exception as e:
        print(f"其他错误: {e}")

def test_single_stock():
    """测试 /api/market/stock/AAPL 接口"""
    url = "http://127.0.0.1:8889/api/market/stock/AAPL"
    
    print(f"\n测试 {url}...")
    start_time = time.time()
    
    try:
        response = requests.get(url, timeout=10)
        elapsed = time.time() - start_time
        
        print(f"响应时间: {elapsed:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"AAPL数据: ${data.get('price')} ({data.get('changePercent', 0)}%)")
        else:
            print(f"响应内容: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        print(f"请求超时 (>{time.time()-start_time:.1f}秒)")
    except Exception as e:
        print(f"错误: {e}")

if __name__ == "__main__":
    print("=== API接口测试 ===")
    test_market_stocks()
    test_single_stock()