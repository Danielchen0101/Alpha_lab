#!/usr/bin/env python3
"""
获取真实API响应，查看result结构
"""
import requests
import json

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

print("=== 获取真实API响应 ===")
print(f"URL: http://127.0.0.1:8892/api/backtest/optimize")

try:
    # 发送请求
    response = requests.post(
        "http://127.0.0.1:8892/api/backtest/optimize",
        json=payload,
        timeout=30
    )
    
    print(f"响应状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        
        # 打印第一条结果的完整结构
        if data.get('results') and len(data['results']) > 0:
            first_result = data['results'][0]
            print(f"\n=== 第一条结果的完整结构 ===")
            print(json.dumps(first_result, indent=2))
            
            # 特别检查参数字段
            print(f"\n=== 参数字段检查 ===")
            print(f"直接字段:")
            for key in ['shortMa', 'longMa', 'shortMaPeriod', 'longMaPeriod', 'short_ma', 'long_ma']:
                if key in first_result:
                    print(f"  {key}: {first_result[key]}")
                else:
                    print(f"  {key}: 不存在")
            
            print(f"\nparameters字段:")
            if 'parameters' in first_result:
                params = first_result['parameters']
                print(f"  parameters类型: {type(params)}")
                print(f"  parameters内容: {params}")
                for key in ['shortMaPeriod', 'longMaPeriod', 'short_ma', 'long_ma']:
                    if key in params:
                        print(f"  parameters.{key}: {params[key]}")
                    else:
                        print(f"  parameters.{key}: 不存在")
            else:
                print(f"  parameters: 不存在")
        else:
            print(f"错误: results为空")
            
    else:
        print(f"错误: {response.status_code}")
        print(f"响应内容: {response.text}")
        
except Exception as e:
    print(f"\n=== 请求异常 ===")
    print(f"错误类型: {type(e).__name__}")
    print(f"错误信息: {str(e)}")