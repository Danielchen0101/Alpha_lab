#!/usr/bin/env python3
"""
测试同一组参数重复运行的结果一致性
"""
import requests
import json
import time

# 测试数据 - 固定参数
payload = {
    "symbol": "AAPL",
    "strategy": "moving_average",
    "startDate": "2025-10-01",
    "endDate": "2026-04-10",
    "initialCapital": 100000,
    "shortMaRange": {
        "start": 20,
        "end": 20,
        "step": 1
    },
    "longMaRange": {
        "start": 50,
        "end": 50,
        "step": 1
    }
}

print("=== 测试同一组参数重复运行的结果一致性 ===")
print(f"固定参数: Short MA=20, Long MA=50")
print(f"Symbol: AAPL, Period: 2025-10-01 to 2026-04-10")

# 启动后端
import subprocess
import os
import signal

print("\n启动后端服务...")
backend_process = subprocess.Popen(
    ["py", "start_quant_backend.py"],
    cwd=os.getcwd(),
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# 等待后端启动
time.sleep(5)

results = []

try:
    for i in range(2):
        print(f"\n=== 第 {i+1} 次运行 ===")
        
        try:
            response = requests.post(
                "http://127.0.0.1:8892/api/backtest/optimize",
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get('results') and len(data['results']) > 0:
                    result = data['results'][0]
                    print(f"结果 {i+1}:")
                    print(f"  totalReturn: {result.get('totalReturn')}%")
                    print(f"  sharpeRatio: {result.get('sharpeRatio')}")
                    print(f"  trades: {result.get('trades')}")
                    print(f"  maxDrawdown: {result.get('maxDrawdown')}%")
                    print(f"  annualizedReturn: {result.get('annualizedReturn')}%")
                    
                    # 保存结果用于比较
                    results.append({
                        'totalReturn': result.get('totalReturn'),
                        'sharpeRatio': result.get('sharpeRatio'),
                        'trades': result.get('trades'),
                        'maxDrawdown': result.get('maxDrawdown'),
                        'annualizedReturn': result.get('annualizedReturn')
                    })
                else:
                    print(f"错误: results为空")
            else:
                print(f"错误: {response.status_code}")
                print(f"响应内容: {response.text}")
                
        except Exception as e:
            print(f"请求异常: {str(e)}")
            
        # 等待1秒再进行下一次
        time.sleep(1)
        
finally:
    # 停止后端
    print("\n停止后端服务...")
    backend_process.terminate()
    backend_process.wait()

# 比较结果
print("\n=== 结果一致性比较 ===")
if len(results) == 2:
    result1 = results[0]
    result2 = results[1]
    
    print("字段对比:")
    for field in ['totalReturn', 'sharpeRatio', 'trades', 'maxDrawdown', 'annualizedReturn']:
        val1 = result1[field]
        val2 = result2[field]
        match = val1 == val2
        print(f"  {field}: {val1} vs {val2} - {'✅ 一致' if match else '❌ 不一致'}")
    
    # 检查差异
    differences = []
    for field in ['totalReturn', 'sharpeRatio', 'trades', 'maxDrawdown', 'annualizedReturn']:
        if result1[field] != result2[field]:
            differences.append(field)
    
    if differences:
        print(f"\n❌ 发现不一致的字段: {differences}")
        print("可能原因:")
        print("1. 策略中有随机因素")
        print("2. 数据获取有变化")
        print("3. 计算中有浮点数精度问题")
    else:
        print(f"\n✅ 所有字段完全一致")
else:
    print("无法获取足够的结果进行比较")