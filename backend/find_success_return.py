#!/usr/bin/env python3
"""
查找后端函数的成功返回语句
"""

import re

def find_success_return(pattern, function_name):
    """查找函数的成功返回语句"""
    print(f"\n查找 {function_name} 函数的成功返回语句...")
    
    with open("start_quant_backend.py", "r", encoding="utf-8") as f:
        content = f.read()
    
    # 查找函数
    func_pattern = rf'def {function_name}\([^)]*\):.*?return jsonify\([^)]+\)'
    match = re.search(func_pattern, content, re.DOTALL)
    
    if not match:
        print(f"未找到 {function_name} 函数")
        return
    
    func_code = match.group(0)
    
    # 查找所有返回语句
    return_pattern = r'return jsonify\(([^)]+)\)'
    returns = list(re.finditer(return_pattern, func_code, re.DOTALL))
    
    print(f"找到 {len(returns)} 个返回语句")
    
    for i, return_match in enumerate(returns):
        return_expr = return_match.group(1)
        
        # 检查是否是成功返回
        if '"success": True' in return_expr or "'success': True" in return_expr:
            print(f"\n[{i+1}] 成功返回语句:")
            print("-" * 80)
            
            # 显示返回表达式的前300个字符
            preview = return_expr[:300]
            if len(return_expr) > 300:
                preview += "..."
            print(preview)
            
            # 检查是否包含 result 字段
            if '"result"' in return_expr or "'result'" in return_expr:
                print("\n这个返回语句已经包含 'result' 字段")
            else:
                print("\n这个返回语句不包含 'result' 字段")
                
                # 分析结构，建议如何添加 result 包装
                print("\n当前结构分析:")
                lines = return_expr.strip().split('\n')
                for line in lines[:10]:  # 只显示前10行
                    line_stripped = line.strip()
                    if line_stripped and not line_stripped.startswith('#'):
                        print(f"  {line_stripped}")
                
                print("\n建议修改为:")
                print('  "result": {')
                for line in lines[:5]:  # 只显示前5行作为示例
                    line_stripped = line.strip()
                    if line_stripped and not line_stripped.startswith('#'):
                        print(f"    {line_stripped}")
                print("  }")
                print("  ... (其他字段移到 result 内部)")
            
            print("-" * 80)

if __name__ == "__main__":
    # 查找 run_backtest 的成功返回
    find_success_return(r'def run_backtest\([^)]*\):', "run_backtest")
    
    # 查找 run_parameter_optimization 的成功返回
    find_success_return(r'def run_parameter_optimization\([^)]*\):', "run_parameter_optimization")