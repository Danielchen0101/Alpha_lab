import re

# 读取原文件
with open('frontend/src/pages/SymbolAnalysis.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 读取修复后的1 Week代码
with open('frontend/src/pages/SymbolAnalysis_1week_fixed.tsx', 'r', encoding='utf-8') as f:
    fixed_code = f.read()

# 找到1 Week处理的开始和结束
# 开始标记：包含"=== 1 Week 专用"的行
# 结束标记：包含"processedData = finalData;"的行，后面跟着"console.log('[1 Week] ====== 1 Week数据处理完成 ======');"

# 使用正则表达式找到1 Week处理部分
pattern = r'      // === 1 Week 专用：重新实现，确保从3/13 09:30开始，包含16:00收盘价 ===.*?      console\.log\(\'\[1 Week\] ====== 1 Week数据处理完成 ======\'\);'
match = re.search(pattern, content, re.DOTALL)

if match:
    print("找到1 Week处理部分，开始替换...")
    start_pos = match.start()
    end_pos = match.end()
    
    # 构建新的内容
    new_content = content[:start_pos] + fixed_code + content[end_pos:]
    
    # 写入新文件
    with open('frontend/src/pages/SymbolAnalysis.tsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("替换完成！")
else:
    print("未找到1 Week处理部分，尝试其他模式...")
    
    # 尝试其他模式
    pattern2 = r'      // === 1 Week 专用.*?      console\.log\(\'\[1 Week\] ====== 1 Week数据处理完成 ======\'\);'
    match2 = re.search(pattern2, content, re.DOTALL)
    
    if match2:
        print("找到1 Week处理部分（模式2），开始替换...")
        start_pos = match2.start()
        end_pos = match2.end()
        
        # 构建新的内容
        new_content = content[:start_pos] + fixed_code + content[end_pos:]
        
        # 写入新文件
        with open('frontend/src/pages/SymbolAnalysis.tsx', 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print("替换完成！")
    else:
        print("仍然未找到，请手动检查文件结构")