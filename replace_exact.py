# 精确替换1 Week处理部分

# 读取原文件
with open('frontend/src/pages/SymbolAnalysis.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 读取简化修复版
with open('frontend/src/pages/SymbolAnalysis_1week_simple.tsx', 'r', encoding='utf-8') as f:
    new_lines = f.readlines()

# 找到开始行和结束行
start_line = -1
end_line = -1

for i, line in enumerate(lines):
    if '=== 1 Week 专用：重新实现，确保从3/13 09:30开始，包含16:00收盘价 ===' in line:
        start_line = i
        print(f"找到开始行: {i+1}")
    
    # 找到结束位置：包含"processedData = finalData;"的行，并且在if块内
    if start_line != -1 and i > start_line:
        if 'processedData = finalData;' in line:
            # 检查这个processedData = finalData;是否在1 Week的if块内
            # 查找对应的右大括号
            brace_count = 0
            for j in range(start_line, i+1):
                if '{' in lines[j]:
                    brace_count += 1
                if '}' in lines[j]:
                    brace_count -= 1
            
            if brace_count == 1:  # 还在if块内
                end_line = i
                print(f"找到结束行: {i+1}")
                break

if start_line != -1 and end_line != -1:
    print(f"替换从第{start_line+1}行到第{end_line+1}行")
    
    # 构建新内容
    new_content = lines[:start_line] + new_lines + lines[end_line+1:]
    
    # 写入文件
    with open('frontend/src/pages/SymbolAnalysis.tsx', 'w', encoding='utf-8') as f:
        f.writelines(new_content)
    
    print("替换成功！")
else:
    print("无法找到准确的替换位置")
    print(f"start_line: {start_line}, end_line: {end_line}")