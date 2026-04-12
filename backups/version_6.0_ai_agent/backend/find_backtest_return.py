#!/usr/bin/env python3
"""
查找后端 backtest 函数的返回语句
"""

import re

def find_backtest_return():
    """查找 run_backtest 函数的返回语句"""
    print("查找 run_backtest 函数的返回语句...")
    
    with open("start_quant_backend.py", "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    in_function = False
    function_lines = []
    
    for i, line in enumerate(lines):
        if line.strip().startswith("def run_backtest"):
            in_function = True
            print(f"找到 run_backtest 函数在第 {i+1} 行")
        
        if in_function:
            function_lines.append((i+1, line))
            
            # 查找返回语句
            if "return jsonify" in line:
                print(f"\n找到返回语句在第 {i+1} 行:")
                print(f"  {line.strip()}")
                
                # 显示上下文
                start = max(0, i-10)
                end = min(len(lines), i+11)
                print(f"\n上下文 ({start+1}-{end}):")
                for j in range(start, end):
                    print(f"{j+1:4}: {lines[j].rstrip()}")
                
                # 检查这个返回语句
                if '"result"' in line or "'result'" in line:
                    print("\n这个返回语句包含 'result' 字段")
                else:
                    print("\n这个返回语句不包含 'result' 字段")
        
        # 函数结束（下一个def或文件结束）
        if in_function and i+1 < len(lines) and lines[i+1].strip().startswith("def "):
            in_function = False
    
    print(f"\n总共分析了 {len(function_lines)} 行函数代码")

def find_optimization_return():
    """查找 run_parameter_optimization 函数的返回语句"""
    print("\n" + "=" * 80)
    print("查找 run_parameter_optimization 函数的返回语句...")
    
    with open("start_quant_backend.py", "r", encoding="utf-8") as f:
        lines = f.readlines()
    
    in_function = False
    function_lines = []
    
    for i, line in enumerate(lines):
        if line.strip().startswith("def run_parameter_optimization"):
            in_function = True
            print(f"找到 run_parameter_optimization 函数在第 {i+1} 行")
        
        if in_function:
            function_lines.append((i+1, line))
            
            # 查找返回语句
            if "return jsonify" in line:
                print(f"\n找到返回语句在第 {i+1} 行:")
                print(f"  {line.strip()}")
                
                # 显示上下文
                start = max(0, i-10)
                end = min(len(lines), i+11)
                print(f"\n上下文 ({start+1}-{end}):")
                for j in range(start, end):
                    print(f"{j+1:4}: {lines[j].rstrip()}")
                
                # 检查这个返回语句
                if '"result"' in line or "'result'" in line:
                    print("\n这个返回语句包含 'result' 字段")
                else:
                    print("\n这个返回语句不包含 'result' 字段")
        
        # 函数结束（下一个def或文件结束）
        if in_function and i+1 < len(lines) and lines[i+1].strip().startswith("def "):
            in_function = False
    
    print(f"\n总共分析了 {len(function_lines)} 行函数代码")

if __name__ == "__main__":
    find_backtest_return()
    find_optimization_return()