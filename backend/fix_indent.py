#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复start_quant_backend.py的缩进错误
删除从第1757行到第1886行的混入代码
"""

import sys

def fix_indentation():
    """修复缩进错误"""
    input_file = "start_quant_backend.py"
    output_file = "start_quant_backend_fixed.py"
    
    print(f"读取文件: {input_file}")
    
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    print(f"文件总行数: {len(lines)}")
    
    # 找到get_backtest_history函数的开始行
    get_backtest_history_line = -1
    for i, line in enumerate(lines):
        if "def get_backtest_history():" in line:
            get_backtest_history_line = i
            break
    
    if get_backtest_history_line == -1:
        print("错误: 找不到get_backtest_history函数")
        return False
    
    print(f"get_backtest_history函数在第{get_backtest_history_line + 1}行")
    
    # 删除从第1757行到get_backtest_history_line-1行的代码
    # 注意：Python列表索引从0开始，行号从1开始
    start_line = 1756  # 第1757行在列表中是索引1756
    end_line = get_backtest_history_line - 1  # get_backtest_history_line之前一行
    
    print(f"删除行范围: {start_line + 1} 到 {end_line + 1}")
    
    # 检查第1756行是什么
    print(f"\n第1756行内容: {lines[1755] if 1755 < len(lines) else '超出范围'}")
    print(f"第1757行内容: {lines[1756] if 1756 < len(lines) else '超出范围'}")
    
    # 保留run_backtest函数的正常结束
    # run_backtest函数应该在第1756行结束（return jsonify(result), 200）
    # 之后的所有代码都是混入的run_simple_backtest代码
    
    # 创建新文件，只保留正确的代码
    new_lines = []
    
    # 保留前1756行（包括run_backtest函数的正常结束）
    for i in range(min(1756, len(lines))):
        new_lines.append(lines[i])
    
    # 跳过混入的代码，直接跳到get_backtest_history函数
    for i in range(get_backtest_history_line, len(lines)):
        new_lines.append(lines[i])
    
    print(f"\n原始文件行数: {len(lines)}")
    print(f"新文件行数: {len(new_lines)}")
    print(f"删除了 {len(lines) - len(new_lines)} 行混入代码")
    
    # 写入新文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    
    print(f"\n已保存修复后的文件: {output_file}")
    
    # 验证语法
    try:
        import ast
        with open(output_file, 'r', encoding='utf-8') as f:
            content = f.read()
        ast.parse(content)
        print("✅ 语法验证通过")
        return True
    except SyntaxError as e:
        print(f"❌ 语法错误: {e}")
        print(f"错误位置: 第{e.lineno}行")
        return False

if __name__ == "__main__":
    success = fix_indentation()
    if success:
        print("\n修复完成！")
        print("请将start_quant_backend_fixed.py重命名为start_quant_backend.py")
    else:
        print("\n修复失败！")
        sys.exit(1)