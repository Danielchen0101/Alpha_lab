#!/usr/bin/env python3
"""
详细测试优化API，查看调试输出
"""
import requests
import json
import sys

# 测试数据
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
print(f"URL: http://127.0.0.1:8892/api/backtest/optimize")
print(f"Payload: {json.dumps(payload, indent=2)}")

try:
    # 发送请求
    response = requests.post(
        "http://127.0.0.1:8892/api/backtest/optimize",
        json=payload,
        timeout=30
    )
    
    print(f"\n=== 响应状态码: {response.status_code} ===")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Success: {data.get('success')}")
        print(f"Optimization ID: {data.get('optimizationId')}")
        print(f"Results length: {len(data.get('results', []))}")
        print(f"Valid combinations: {data.get('summary', {}).get('validCombinations', 0)}")
        
        # 打印所有结果
        print(f"\n=== 所有结果 ===")
        for i, result in enumerate(data.get('results', [])):
            print(f"Result {i+1}:")
            print(f"  Rank: {result.get('rank')}")
            print(f"  Total Return: {result.get('totalReturn')}%")
            print(f"  Sharpe Ratio: {result.get('sharpeRatio')}")
            print(f"  Trades: {result.get('trades')}")
            print(f"  Parameters: {result.get('parameters')}")
            print(f"  Data Source: {result.get('dataSource')}")
            print(f"  Data Points: {result.get('dataPoints')}")
            print()
        
        # 打印摘要信息
        print(f"\n=== 摘要信息 ===")
        summary = data.get('summary', {})
        print(f"Total Combinations: {summary.get('totalCombinations')}")
        print(f"Valid Combinations: {summary.get('validCombinations')}")
        print(f"Best Sharpe Ratio: {summary.get('bestSharpeRatio')}")
        print(f"Best Total Return: {summary.get('bestTotalReturn')}%")
        print(f"Worst Total Return: {summary.get('worstTotalReturn')}%")
        print(f"Avg Total Return: {summary.get('avgTotalReturn')}%")
        
        # 打印参数信息
        print(f"\n=== 参数信息 ===")
        params = data.get('parameters', {})
        print(f"Symbol: {params.get('symbol')}")
        print(f"Strategy: {params.get('strategy')}")
        print(f"Start Date: {params.get('startDate')}")
        print(f"End Date: {params.get('endDate')}")
        print(f"Initial Capital: {params.get('initialCapital')}")
        print(f"Data Source: {params.get('dataSource')}")
        print(f"Historical Data Points: {params.get('historicalDataPoints')}")
        
    else:
        print(f"错误: {response.status_code}")
        print(f"响应内容: {response.text}")
        
except Exception as e:
    print(f"\n=== 请求异常 ===")
    print(f"错误类型: {type(e).__name__}")
    print(f"错误信息: {str(e)}")