#!/usr/bin/env python3
"""
调试后端响应结构
"""

import json
import requests

def debug_backend_responses():
    """调试后端响应结构"""
    
    print("=" * 80)
    print("调试后端响应结构")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8892"
    
    # 1. 测试 backtest API 并查看完整响应
    print("\n1. Backtest API 完整响应")
    print("-" * 40)
    
    backtest_payload = {
        "strategy": "moving_average",
        "startDate": "2025-04-01",
        "endDate": "2026-04-10",
        "initialCapital": 10000,
        "symbols": ["AAPL"],
        "dataMode": "real",
        "parameters": {
            "shortMaPeriod": 20,
            "longMaPeriod": 50
        }
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/backtest/run",
            json=backtest_payload,
            timeout=60
        )
        
        if response.status_code == 200:
            data = response.json()
            print("Backtest 响应完整结构:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            # 分析结构
            print("\nBacktest 响应分析:")
            print(f"成功: {data.get('success', False)}")
            print(f"所有字段: {list(data.keys())}")
            
            # 检查是否有 performanceMetrics
            if 'performanceMetrics' in data:
                metrics = data['performanceMetrics']
                print(f"performanceMetrics 字段: {list(metrics.keys())}")
                print(f"totalReturn: {metrics.get('totalReturn', 'N/A')}")
                print(f"sharpeRatio: {metrics.get('sharpeRatio', 'N/A')}")
                
            # 检查是否有其他可能的结果字段
            for key in ['data', 'result', 'results', 'backtest', 'analysis']:
                if key in data:
                    print(f"找到 {key} 字段: {type(data[key])}")
                    if isinstance(data[key], dict):
                        print(f"  {key} 的子字段: {list(data[key].keys())}")
        else:
            print(f"请求失败: {response.status_code}")
            print(f"响应: {response.text[:500]}")
            
    except Exception as e:
        print(f"异常: {str(e)}")
    
    # 2. 测试 optimization API 并查看完整响应
    print("\n2. Optimization API 完整响应")
    print("-" * 40)
    
    optimization_payload = {
        "symbol": "AAPL",
        "strategy": "moving_average",
        "startDate": "2025-04-01",
        "endDate": "2026-04-10",
        "initialCapital": 10000,
        "shortMaRange": {"start": 5, "end": 25, "step": 5},
        "longMaRange": {"start": 50, "end": 200, "step": 25}
    }
    
    try:
        response = requests.post(
            f"{base_url}/api/backtest/optimize",
            json=optimization_payload,
            timeout=120
        )
        
        if response.status_code == 200:
            data = response.json()
            print("Optimization 响应完整结构:")
            print(json.dumps(data, indent=2, ensure_ascii=False))
            
            # 分析结构
            print("\nOptimization 响应分析:")
            print(f"成功: {data.get('success', False)}")
            print(f"所有字段: {list(data.keys())}")
            
            # 检查关键字段
            if 'results' in data:
                results = data['results']
                print(f"results 长度: {len(results) if isinstance(results, list) else 'N/A'}")
                if isinstance(results, list) and len(results) > 0:
                    print(f"第一个结果: {results[0]}")
                    
            if 'parameters' in data:
                params = data['parameters']
                print(f"parameters 字段: {list(params.keys())}")
                
        else:
            print(f"请求失败: {response.status_code}")
            print(f"响应: {response.text[:500]}")
            
    except Exception as e:
        print(f"异常: {str(e)}")
    
    print("\n" + "=" * 80)
    print("调试完成")
    print("=" * 80)

if __name__ == "__main__":
    debug_backend_responses()