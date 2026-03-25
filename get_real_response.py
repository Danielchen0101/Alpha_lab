#!/usr/bin/env python3
"""
直接调用后端API获取真实的响应
"""
import requests
import json

# 后端API地址
BACKEND_URL = "http://localhost:50005/api/backtest"

# 模拟前端发送的请求数据（移动平均策略，模拟数据模式）
request_data = {
    "symbol": "AAPL",
    "strategy": "moving_average",
    "startDate": "2025-01-01",
    "endDate": "2025-03-01",
    "initialCapital": 100000,
    "dataMode": "simulated"
}

print("=== 发送请求到后端 ===")
print(f"URL: {BACKEND_URL}")
print(f"请求数据: {json.dumps(request_data, indent=2)}")

try:
    # 发送POST请求
    response = requests.post(BACKEND_URL, json=request_data, timeout=10)
    
    print(f"\n=== 后端响应状态 ===")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        response_data = response.json()
        print(f"\n=== 真实后端响应JSON ===")
        print(json.dumps(response_data, indent=2))
        
        # 提取关键字段
        if "results" in response_data:
            results = response_data["results"]
            print(f"\n=== 关键指标值 ===")
            print(f"totalReturn: {results.get('totalReturn', 'N/A')}")
            print(f"annualizedReturn: {results.get('annualizedReturn', 'N/A')}")
            print(f"profitLoss: {results.get('profitLoss', 'N/A')}")
            print(f"trades: {results.get('trades', 'N/A')}")
            print(f"avgReturnPerTrade: {results.get('avgReturnPerTrade', 'N/A')}")
            print(f"winRate: {results.get('winRate', 'N/A')}")
            print(f"profitFactor: {results.get('profitFactor', 'N/A')}")
            print(f"expectancy: {results.get('expectancy', 'N/A')}")
            print(f"maxDrawdown: {results.get('maxDrawdown', 'N/A')}")
            print(f"calmarRatio: {results.get('calmarRatio', 'N/A')}")
            
            # 保存到文件供后续分析
            with open("real_backend_response.json", "w") as f:
                json.dump(response_data, f, indent=2)
            print(f"\n✅ 响应已保存到 real_backend_response.json")
        else:
            print("❌ 响应中没有results字段")
    else:
        print(f"❌ 请求失败: {response.status_code}")
        print(f"响应内容: {response.text}")
        
except requests.exceptions.ConnectionError:
    print("❌ 无法连接到后端服务器，请确保后端正在运行")
    print("运行命令: cd backend && python start_quant_backend.py")
except requests.exceptions.Timeout:
    print("❌ 请求超时")
except Exception as e:
    print(f"❌ 发生错误: {e}")

print("\n=== 备选方案：直接读取后端日志 ===")
print("如果API调用失败，请检查后端日志中的响应输出")