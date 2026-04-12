#!/usr/bin/env python3
"""
直接测试优化函数
"""
import sys
import os
sys.path.append('.')

# 模拟请求
class MockRequest:
    def __init__(self, data):
        self.data = data
    
    def get_json(self):
        return self.data

# 临时替换request
import start_quant_backend
original_request = start_quant_backend.request

# 测试数据
test_data = {
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

print("=== 直接测试优化函数 ===")
print(f"测试数据: {test_data}")

# 模拟请求
start_quant_backend.request = MockRequest(test_data)

try:
    # 调用函数
    result = start_quant_backend.run_parameter_optimization()
    print(f"\n=== 函数返回 ===")
    print(f"类型: {type(result)}")
    
    if hasattr(result, 'get_json'):
        data = result.get_json()
        print(f"Success: {data.get('success')}")
        print(f"Results length: {len(data.get('results', []))}")
        print(f"Valid combinations: {data.get('summary', {}).get('validCombinations', 0)}")
        
        if data.get('results'):
            print(f"\n前3个结果:")
            for i, r in enumerate(data['results'][:3]):
                print(f"  {i+1}. Rank {r.get('rank')}, Return: {r.get('totalReturn')}%, Trades: {r.get('trades')}")
    else:
        print(f"原始返回: {result}")
        
except Exception as e:
    print(f"\n=== 错误 ===")
    print(f"错误类型: {type(e).__name__}")
    print(f"错误信息: {str(e)}")
    import traceback
    traceback.print_exc()

finally:
    # 恢复原始request
    start_quant_backend.request = original_request