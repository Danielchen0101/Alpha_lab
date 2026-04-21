#!/usr/bin/env python3
"""
直接调用后端函数获取响应
"""
import sys
import os

# 添加当前目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 模拟Flask请求上下文
class MockRequest:
    def __init__(self, json_data):
        self.json_data = json_data
    
    def get_json(self):
        return self.json_data

# 导入后端函数
try:
    # 直接导入后端模块
    import start_quant_backend as backend
    
    # 创建模拟请求
    request_data = {
        "symbol": "AAPL",
        "strategy": "moving_average",
        "startDate": "2025-01-01",
        "endDate": "2025-03-01",
        "initialCapital": 100000,
        "dataMode": "simulated"
    }
    
    print("=== 直接调用后端函数 ===")
    print(f"请求数据: {request_data}")
    
    # 由于后端使用Flask，我们需要模拟调用
    # 直接调用run_backtest函数
    from start_quant_backend import run_backtest
    
    # 调用函数
    response = run_backtest(request_data)
    
    print(f"\n=== 后端响应 ===")
    import json
    print(json.dumps(response, indent=2))
    
    # 提取关键字段
    if "results" in response:
        results = response["results"]
        print(f"\n=== 关键指标 ===")
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
        
        # 保存响应
        with open("direct_response.json", "w") as f:
            json.dump(response, f, indent=2)
        print(f"\n✅ 响应已保存到 direct_response.json")
    
except Exception as e:
    print(f"❌ 错误: {e}")
    import traceback
    traceback.print_exc()

print("\n=== 备选：直接读取后端计算结果 ===")
print("让我直接查看后端计算逻辑...")

# 直接查看后端计算逻辑
with open("start_quant_backend.py", "r", encoding="utf-8") as f:
    content = f.read()
    
# 查找模拟数据模式的结果计算
import re
pattern = r'"avgReturnPerTrade":\s*round\(([^,]+),\s*2\)'
match = re.search(pattern, content)
if match:
    print(f"找到avgReturnPerTrade计算: {match.group(0)}")

pattern = r'"winRate":\s*round\(([^,]+),\s*1\)'
match = re.search(pattern, content)
if match:
    print(f"找到winRate计算: {match.group(0)}")

pattern = r'"calmarRatio":\s*round\(([^,]+),\s*2\)'
match = re.search(pattern, content)
if match:
    print(f"找到calmarRatio计算: {match.group(0)}")