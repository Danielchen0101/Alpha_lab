import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入Flask应用
from quant_backend import app

print("=== Flask App Diagnosis ===")
print(f"App name: {app.name}")

# 打印所有路由
print("\nAll routes:")
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

print(f"\nTotal routes found: {len(routes)}")

# 测试导入函数
print("\nTesting function imports:")
try:
    from quant_backend import get_stock_detail, get_stock_history, get_stocks
    print("  SUCCESS: All functions can be imported")
    
    # 测试函数是否可调用
    print(f"  get_stock_detail is callable: {callable(get_stock_detail)}")
    print(f"  get_stock_history is callable: {callable(get_stock_history)}")
    print(f"  get_stocks is callable: {callable(get_stocks)}")
    
except ImportError as e:
    print(f"  FAILED: Import error: {e}")
except Exception as e:
    print(f"  ERROR: {e}")

print("\n=== Diagnosis Complete ===")