"""
修复analyze_trend_with_deepseek函数的开头部分
"""

import re

def fix_deepseek_function():
    with open('start_quant_backend_repaired.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找analyze_trend_with_deepseek函数
    pattern = r'def analyze_trend_with_deepseek\(symbol, stock_data, news_data, profile_data, technical_indicators=None, structured_news=None\):.*?(?=\n\ndef|\n@app|\Z)'
    match = re.search(pattern, content, re.DOTALL)
    
    if not match:
        print("未找到analyze_trend_with_deepseek函数")
        return
    
    func_text = match.group(0)
    print(f"找到函数，长度: {len(func_text)} 字符")
    
    # 检查函数开头
    lines = func_text.split('\n')
    
    # 找到try:的位置
    try_line_index = -1
    for i, line in enumerate(lines):
        if 'try:' in line and i > 10:  # 跳过开头的几行
            try_line_index = i
            break
    
    if try_line_index == -1:
        print("未找到try:语句")
        return
    
    print(f"try:在第{try_line_index+1}行")
    
    # 检查try:之前的行
    print(f"try:之前的行:")
    for i in range(max(0, try_line_index-5), try_line_index):
        print(f"  {i+1}: {lines[i]}")
    
    # 检查try:之后的行
    print(f"try:之后的行:")
    for i in range(try_line_index, min(len(lines), try_line_index+5)):
        print(f"  {i+1}: {lines[i]}")
    
    # 修复：确保try:之前只有函数定义和docstring
    # 删除try:之前的所有非函数定义行
    fixed_lines = []
    in_problematic_section = False
    
    for i, line in enumerate(lines):
        if i < try_line_index:
            # 保留函数定义和docstring
            if i == 0 or i == 1 or (i == 2 and '"""' in line):
                fixed_lines.append(line)
            elif 'print(f\'DeepSeek API' in line or 'return {' in line:
                # 跳过这些错误行
                print(f"跳过错误行 {i+1}: {line[:50]}...")
                continue
            else:
                fixed_lines.append(line)
        else:
            fixed_lines.append(line)
    
    # 确保try:后面有正确的缩进
    for i in range(len(fixed_lines)):
        if 'try:' in fixed_lines[i]:
            # 检查下一行的缩进
            if i+1 < len(fixed_lines) and not fixed_lines[i+1].startswith('    '):
                fixed_lines[i+1] = '    ' + fixed_lines[i+1].lstrip()
    
    fixed_func = '\n'.join(fixed_lines)
    
    # 替换原函数
    new_content = content[:match.start()] + fixed_func + content[match.end():]
    
    # 保存修复后的文件
    with open('start_quant_backend_repaired.py.fixed', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("修复完成，已保存到start_quant_backend_repaired.py.fixed")
    
    # 验证修复
    print("\n验证修复后的函数开头:")
    fixed_lines = fixed_func.split('\n')
    for i in range(min(20, len(fixed_lines))):
        print(f"{i+1:3}: {fixed_lines[i]}")

if __name__ == '__main__':
    fix_deepseek_function()