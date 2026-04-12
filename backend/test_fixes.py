#!/usr/bin/env python3
"""
测试修复效果
"""
import requests
import json
import time

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

print("=== 测试修复效果 ===")

# 启动后端
import subprocess
import os

print("启动后端服务...")
backend_process = subprocess.Popen(
    ["py", "start_quant_backend.py"],
    cwd=os.getcwd(),
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# 等待后端启动
time.sleep(5)

try:
    print("\n发送优化请求...")
    response = requests.post(
        "http://127.0.0.1:8892/api/backtest/optimize",
        json=payload,
        timeout=30
    )
    
    if response.status_code == 200:
        data = response.json()
        results = data.get('results', [])
        
        print(f"获取到 {len(results)} 个结果")
        
        # 检查最大回撤是否相同
        max_dd_values = [r.get('maxDrawdown') for r in results]
        unique_max_dd = set(max_dd_values)
        
        print(f"\n1. 最大回撤分析:")
        print(f"   - 总结果数: {len(results)}")
        print(f"   - 唯一最大回撤值: {len(unique_max_dd)} 个")
        print(f"   - 最大回撤值分布: {sorted(list(unique_max_dd))[:5]}...")
        
        # 检查排名顺序
        ranks = [r.get('rank') for r in results]
        is_sorted = all(ranks[i] <= ranks[i+1] for i in range(len(ranks)-1))
        
        print(f"\n2. 排名顺序分析:")
        print(f"   - 排名列表: {ranks[:10]}...")
        print(f"   - 是否按顺序排列: {'✅ 是' if is_sorted else '❌ 否'}")
        
        # 检查夏普比率是否按降序排列
        sharpe_values = [r.get('sharpeRatio') for r in results]
        is_sharpe_descending = all(sharpe_values[i] >= sharpe_values[i+1] for i in range(len(sharpe_values)-1))
        
        print(f"\n3. 夏普比率排序分析:")
        print(f"   - 前5个夏普比率: {sharpe_values[:5]}")
        print(f"   - 是否按降序排列: {'✅ 是' if is_sharpe_descending else '❌ 否'}")
        
        # 检查参数组合
        print(f"\n4. 参数组合分析:")
        for i, result in enumerate(results[:3]):
            print(f"   结果 {i+1}:")
            print(f"     - Rank: {result.get('rank')}")
            print(f"     - Short MA: {result.get('short_ma')}")
            print(f"     - Long MA: {result.get('long_ma')}")
            print(f"     - Total Return: {result.get('totalReturn')}%")
            print(f"     - Sharpe Ratio: {result.get('sharpeRatio')}")
            print(f"     - Max Drawdown: {result.get('maxDrawdown')}%")
            print(f"     - Trades: {result.get('trades')}")
            
    else:
        print(f"错误: {response.status_code}")
        print(f"响应内容: {response.text}")
        
except Exception as e:
    print(f"请求异常: {str(e)}")
    
finally:
    # 停止后端
    print("\n停止后端服务...")
    backend_process.terminate()
    backend_process.wait()