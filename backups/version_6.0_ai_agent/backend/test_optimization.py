#!/usr/bin/env python3
"""
测试参数优化API
"""
import json
import requests
import sys

def test_optimization():
    """测试优化API"""
    url = "http://127.0.0.1:8892/api/backtest/optimize"
    
    # 测试数据 - 使用较小的参数范围
    payload = {
        "symbol": "AAPL",
        "strategy": "moving_average",
        "startDate": "2025-10-01",
        "endDate": "2026-04-10",
        "initialCapital": 100000,
        "shortMaRange": {
            "start": 5,
            "end": 15,
            "step": 5
        },
        "longMaRange": {
            "start": 20,
            "end": 40,
            "step": 10
        }
    }
    
    print("=== 测试参数优化API ===")
    print(f"URL: {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"\n=== 响应状态码: {response.status_code} ===")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success')}")
            print(f"Optimization ID: {data.get('optimizationId')}")
            print(f"Results length: {len(data.get('results', []))}")
            print(f"Valid combinations: {data.get('summary', {}).get('validCombinations', 0)}")
            
            # 打印前几个结果
            results = data.get('results', [])
            if results:
                print(f"\n=== 前3个结果 ===")
                for i, result in enumerate(results[:3]):
                    print(f"Result {i+1}:")
                    print(f"  Rank: {result.get('rank')}")
                    print(f"  Total Return: {result.get('totalReturn')}%")
                    print(f"  Sharpe Ratio: {result.get('sharpeRatio')}")
                    print(f"  Trades: {result.get('trades')}")
                    print(f"  Parameters: {result.get('parameters')}")
            else:
                print("\n=== 没有结果 ===")
                print("Results为空数组")
                
            # 打印参数信息
            params = data.get('parameters', {})
            if params:
                print(f"\n=== 参数信息 ===")
                print(f"Data Source: {params.get('dataSource')}")
                print(f"Historical Data Points: {params.get('historicalDataPoints')}")
                
        else:
            print(f"错误响应: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"请求失败: {e}")
    except json.JSONDecodeError as e:
        print(f"JSON解析失败: {e}")
        print(f"原始响应: {response.text}")

if __name__ == "__main__":
    test_optimization()