"""
检查当前模块信息
"""

import sys
import os

print("=== 检查Python模块信息 ===")
print(f"当前文件: {__file__}")
print(f"当前目录: {os.path.dirname(os.path.abspath(__file__))}")
print(f"Python路径:")
for path in sys.path:
    print(f"  {path}")

# 检查final_production模块
print("\n=== 检查final_production模块 ===")
try:
    import final_production
    print(f"模块位置: {final_production.__file__}")
    print(f"模块名称: {final_production.__name__}")
    
    # 检查函数
    if hasattr(final_production, 'get_twelvedata_history'):
        func = final_production.get_twelvedata_history
        print(f"函数位置: {func.__module__}.{func.__name__}")
        
        # 检查源代码
        import inspect
        source = inspect.getsource(func)
        print(f"函数源代码长度: {len(source)} 字符")
        print(f"函数是否包含'修复版': {'修复版' in source}")
        print(f"函数是否包含'outputsize = 300': {'outputsize = 300' in source}")
    else:
        print("❌ 模块中没有get_twelvedata_history函数")
except Exception as e:
    print(f"导入模块失败: {e}")