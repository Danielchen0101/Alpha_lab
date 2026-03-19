import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import quant_backend
    print("导入成功!")
    
    # 检查函数是否存在
    print(f"get_stock_detail 存在: {hasattr(quant_backend, 'get_stock_detail')}")
    print(f"get_stock_history 存在: {hasattr(quant_backend, 'get_stock_history')}")
    print(f"get_stocks 存在: {hasattr(quant_backend, 'get_stocks')}")
    
    # 检查路由
    from quant_backend import app
    print(f"\nFlask 应用路由数: {len(list(app.url_map.iter_rules()))}")
    
    for rule in app.url_map.iter_rules():
        if 'stock' in rule.rule:
            print(f"  {rule.rule} -> {rule.endpoint}")
            
except Exception as e:
    print(f"导入失败: {e}")
    import traceback
    traceback.print_exc()