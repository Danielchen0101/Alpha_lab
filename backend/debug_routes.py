#!/usr/bin/env python3
"""
调试路由问题
"""
import start_quant_backend
from flask import Flask, request

app = start_quant_backend.app

print("调试路由注册问题")
print("=" * 60)

# 检查所有路由
print("所有已注册的路由:")
for rule in app.url_map.iter_rules():
    print(f"  {rule.rule} -> {rule.endpoint}")

print("\n" + "=" * 60)
print("检查特定路由的端点函数:")

# 检查特定端点的函数
endpoints_to_check = [
    'ai_trade_status',
    'ai_trade_preview',
    'ai_provider_test'
]

for endpoint in endpoints_to_check:
    try:
        func = app.view_functions.get(endpoint)
        if func:
            print(f"  {endpoint}: 找到函数，位置: {func.__module__}.{func.__name__}")
        else:
            print(f"  {endpoint}: 未找到函数")
    except Exception as e:
        print(f"  {endpoint}: 错误 - {e}")

print("\n" + "=" * 60)
print("测试直接调用函数:")

# 直接调用函数测试
try:
    with app.test_request_context('/api/ai/trade/status'):
        result = start_quant_backend.ai_trade_status()
        print(f"  ai_trade_status() 直接调用成功")
        print(f"  返回类型: {type(result)}")
except Exception as e:
    print(f"  ai_trade_status() 错误: {e}")

print("\n调试完成")