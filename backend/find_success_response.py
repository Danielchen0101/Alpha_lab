#!/usr/bin/env python3
"""
查找成功的返回结构
"""

import re

def find_success_response():
    """查找成功的返回结构"""
    with open('start_quant_backend_fixed.py', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    in_function = False
    function_lines = []
    
    for i, line in enumerate(lines):
        if 'def ai_analyze_single():' in line:
            in_function = True
            function_lines = []
        
        if in_function:
            function_lines.append(line)
            
            # 检查是否到了函数结尾
            if line.strip().startswith('def ') and i > 0 and 'def ai_analyze_single():' not in line:
                break
    
    # 在函数中查找success: True
    for i, line in enumerate(function_lines):
        if "'success': True" in line or '"success": True' in line:
            print(f"找到success: True在第{i+1}行:")
            # 打印上下文
            start = max(0, i-10)
            end = min(len(function_lines), i+20)
            for j in range(start, end):
                print(f"{j+1:4}: {function_lines[j].rstrip()}")
            print("\n" + "="*80 + "\n")

if __name__ == '__main__':
    find_success_response()