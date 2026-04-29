"""
修复analyze_trend_locally函数的try-except块
"""

import re

def fix_try_except():
    with open('start_quant_backend_repaired.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找analyze_trend_locally函数
    pattern = r'def analyze_trend_locally\(symbol, stock_data, news_data, profile_data\):.*?(?=\n\ndef|\n@app|\Z)'
    match = re.search(pattern, content, re.DOTALL)
    
    if not match:
        print("未找到analyze_trend_locally函数")
        return
    
    func_text = match.group(0)
    print(f"找到函数，长度: {len(func_text)} 字符")
    
    # 检查函数结构
    lines = func_text.split('\n')
    
    # 查找try:的位置
    try_line = -1
    for i, line in enumerate(lines):
        if 'try:' in line:
            try_line = i
            break
    
    if try_line == -1:
        print("函数中没有try:语句")
        return
    
    print(f"try:在第{try_line+1}行")
    
    # 查找except的位置
    except_line = -1
    for i in range(try_line, len(lines)):
        if 'except' in lines[i] and lines[i].strip().startswith('except'):
            except_line = i
            break
    
    if except_line == -1:
        print("错误: 有try但没有except")
        # 在函数结尾添加except块
        print("将在函数结尾添加except块")
        
        # 找到函数结尾的return语句
        last_return = -1
        for i in range(len(lines)-1, -1, -1):
            if 'return {' in lines[i]:
                last_return = i
                break
        
        if last_return != -1:
            # 在return之前添加except块
            new_lines = lines[:last_return]
            new_lines.append('    except Exception as e:')
            new_lines.append('        print(f\'[本地规则分析] 分析异常: {str(e)}\')')
            new_lines.append('        return {')
            new_lines.append('            \'trendLabel\': \'Neutral\',')
            new_lines.append('            \'trendScore\': 50,')
            new_lines.append('            \'trendConfidence\': 0.5,')
            new_lines.append('            \'scannerReason\': f\'本地分析异常: {str(e)[:100]}\',')
            new_lines.append('            \'aiReasoning\': None')
            new_lines.append('        }')
            new_lines.extend(lines[last_return:])
            
            fixed_func = '\n'.join(new_lines)
            
            # 替换原函数
            new_content = content[:match.start()] + fixed_func + content[match.end():]
            
            # 保存修复后的文件
            with open('start_quant_backend_repaired.py.fixed2', 'w', encoding='utf-8') as f:
                f.write(new_content)
            
            print("修复完成，已保存到start_quant_backend_repaired.py.fixed2")
            
            # 验证修复
            print("\n验证修复后的函数结尾:")
            for i in range(max(0, len(new_lines)-10), len(new_lines)):
                print(f"{i+1:3}: {new_lines[i]}")
        else:
            print("错误: 找不到return语句")
    else:
        print(f"except在第{except_line+1}行")
        print("函数结构正常")

if __name__ == '__main__':
    fix_try_except()