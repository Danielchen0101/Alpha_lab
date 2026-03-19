import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入Flask应用
from quant_backend import app

print("=== Flask 应用诊断 ===")
print(f"应用名称: {app.name}")

# 打印所有路由
print("\n所有路由:")
routes = []
for rule in app.url_map.iter_rules():
    routes.append({
        'rule': rule.rule,
        'endpoint': rule.endpoint,
        'methods': list(rule.methods)
    })

# 按规则排序
routes.sort(key=lambda x: x['rule'])

for route in routes:
    if 'market' in route['rule'] or 'stock' in route['rule'] or 'history' in route['rule']:
        print(f"  {route['rule']}")
        print(f"    -> {route['endpoint']}")
        print(f"    methods: {route['methods']}")

# 检查特定函数是否存在
print("\n检查关键函数是否存在:")
functions_to_check = ['get_stock_detail', 'get_stock_history', 'get_stocks']
for func_name in functions_to_check:
    exists = hasattr(app.view_functions.get(func_name, None), '__call__')
    print(f"  {func_name}: {'✅ 存在' if exists else '❌ 不存在'}")

# 测试导入函数
print("\n直接导入函数测试:")
try:
    from quant_backend import get_stock_detail, get_stock_history, get_stocks
    print("  ✅ 所有函数都可以导入")
except ImportError as e:
    print(f"  ❌ 导入失败: {e}")

print("\n=== 诊断完成 ===")