"""
修复analyze_trend_with_deepseek函数的缩进错误
"""

import re

def fix_indentation():
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
    
    # 查找缩进错误的位置
    lines = func_text.split('\n')
    for i, line in enumerate(lines):
        if 'DeepSeek API' in line and '调用失败' in line:
            print(f"第{i+1}行可能有缩进问题: {line[:50]}...")
            # 检查前一行
            if i > 0:
                print(f"前一行: {lines[i-1][:50]}...")
            # 检查后一行
            if i < len(lines) - 1:
                print(f"后一行: {lines[i+1][:50]}...")
    
    # 简单修复：重新缩进整个函数
    fixed_lines = []
    in_try_block = False
    indent_level = 0
    
    for line in lines:
        # 检测try块
        if 'try:' in line:
            in_try_block = True
            indent_level = 4
        elif 'except' in line and line.strip().startswith('except'):
            in_try_block = False
            indent_level = 0
        
        # 修复缩进
        if in_try_block and line.strip() and not line.startswith(' ' * indent_level):
            fixed_line = ' ' * indent_level + line.lstrip()
            fixed_lines.append(fixed_line)
            print(f"修复缩进: {line[:30]}... -> {fixed_line[:30]}...")
        else:
            fixed_lines.append(line)
    
    fixed_func = '\n'.join(fixed_lines)
    
    # 替换原函数
    new_content = content[:match.start()] + fixed_func + content[match.end():]
    
    # 保存备份
    with open('start_quant_backend_repaired.py.backup', 'w', encoding='utf-8') as f:
        f.write(content)
    
    # 写入修复后的文件
    with open('start_quant_backend_repaired.py', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("缩进修复完成，已创建备份文件")

if __name__ == '__main__':
    fix_indentation()