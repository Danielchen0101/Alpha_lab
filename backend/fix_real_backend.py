#!/usr/bin/env python3
"""
修复真实后端的缩进问题
"""

import re

def fix_file_indentation(file_path):
    """修复文件的缩进问题"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修复analyze_trend_with_deepseek函数的缩进
    lines = content.split('\n')
    fixed_lines = []
    
    in_function = False
    function_indent = 0
    
    for i, line in enumerate(lines):
        # 检测函数开始
        if 'def analyze_trend_with_deepseek' in line:
            in_function = True
            function_indent = len(line) - len(line.lstrip())
            fixed_lines.append(line)
            continue
        
        if in_function:
            # 计算当前行的缩进
            current_indent = len(line) - len(line.lstrip())
            
            # 如果遇到空行或注释，保持原样
            if line.strip() == '' or line.strip().startswith('#'):
                fixed_lines.append(line)
                continue
            
            # 如果缩进小于函数定义缩进，说明函数结束
            if current_indent <= function_indent and not line.strip().startswith('def '):
                in_function = False
                fixed_lines.append(line)
                continue
            
            # 修复缩进：确保至少比函数定义多4个空格
            if current_indent < function_indent + 4:
                # 重新缩进
                stripped = line.lstrip()
                fixed_lines.append(' ' * (function_indent + 4) + stripped)
            else:
                fixed_lines.append(line)
        else:
            fixed_lines.append(line)
    
    # 写回文件
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(fixed_lines))
    
    print(f"已修复 {file_path} 的缩进问题")

if __name__ == "__main__":
    fix_file_indentation("start_quant_backend_repaired.py")