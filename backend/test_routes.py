import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入Flask应用
from quant_backend import app

print("=== Flask 应用路由表 ===")
for rule in app.url_map.iter_rules():
    print(f"{rule.rule} -> {rule.endpoint}")

print(f"\n总路由数: {len(list(app.url_map.iter_rules()))}")