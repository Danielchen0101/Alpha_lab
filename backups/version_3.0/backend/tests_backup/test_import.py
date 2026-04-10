import sys
import os

print("测试导入start_quant_backend.py...")
try:
    # 尝试导入
    import start_quant_backend
    print("导入成功!")
    
    # 检查是否有app对象
    if hasattr(start_quant_backend, 'app'):
        print("找到Flask应用对象")
        
        # 检查路由
        print("\n路由列表:")
        for rule in start_quant_backend.app.url_map.iter_rules():
            print(f"  {rule.rule} -> {rule.endpoint}")
    else:
        print("没有找到Flask应用对象")
        
except Exception as e:
    print(f"导入失败: {e}")
    import traceback
    traceback.print_exc()