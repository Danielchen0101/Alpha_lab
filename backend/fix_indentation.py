#!/usr/bin/env python3
"""
修复缩进错误
"""

def fix_indentation():
    """修复缩进错误"""
    input_file = 'start_quant_backend_fixed.py'
    output_file = 'start_quant_backend_fixed_indent.py'
    
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # 查找有问题的区域（大约第9790行）
    for i, line in enumerate(lines):
        if i >= 9780 and i <= 9800:
            print(f"Line {i+1}: {repr(line[:50])}")
    
    # 修复：删除第9790-9800行的多余代码
    # 这些是analyze_news_for_stock函数中残留的代码
    fixed_lines = []
    in_bad_section = False
    
    for i, line in enumerate(lines):
        line_num = i + 1
        
        # 跳过有问题的行
        if line_num >= 9790 and line_num <= 9800:
            if 'medium_risk_keywords' in line or 'risk_level' in line or 'for keyword in' in line:
                print(f"跳过第{line_num}行: {line[:50].strip()}")
                continue
        
        fixed_lines.append(line)
    
    # 保存修复后的文件
    with open(output_file, 'w', encoding='utf-8') as f:
        f.writelines(fixed_lines)
    
    print(f"\n修复完成，保存为: {output_file}")
    print(f"原始行数: {len(lines)}")
    print(f"修复后行数: {len(fixed_lines)}")
    
    # 测试语法
    import subprocess
    result = subprocess.run(['py', '-m', 'py_compile', output_file], 
                          capture_output=True, text=True)
    
    if result.returncode == 0:
        print("语法检查: 通过")
    else:
        print("语法检查: 失败")
        print(f"错误: {result.stderr[:200]}")

if __name__ == '__main__':
    fix_indentation()