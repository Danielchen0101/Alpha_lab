#!/usr/bin/env python3
"""
修复后端编码问题
"""

import re

def fix_print_statements():
    file_path = "start_quant_backend.py"
    
    print("读取文件...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 修复print语句中的编码问题
    # 找到所有可能包含特殊字符的print语句
    print_patterns = [
        r"print\(f'\[.*?\] ������Ӧ����: \{response_data\}'\)",
        r"print\(f'\[.*?\] ������������: \{news_data\}'\)",
        r"print\(f'\[.*?\] ������Ӧ����: \{.*?\}'\)",
    ]
    
    fixes_made = 0
    
    for pattern in print_patterns:
        matches = re.findall(pattern, content)
        for match in matches:
            # 替换为安全的print语句
            safe_print = match.replace("response_data}", "str(response_data)[:500]}...")
            safe_print = safe_print.replace("news_data}", "str(news_data)[:500]}...")
            
            if safe_print != match:
                content = content.replace(match, safe_print)
                fixes_made += 1
                print(f"修复: {match[:50]}...")
    
    # 写入修复后的文件
    if fixes_made > 0:
        backup_path = file_path + ".backup_encoding"
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"已创建备份: {backup_path}")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"修复了 {fixes_made} 处编码问题")
    else:
        print("未找到需要修复的编码问题")
    
    return fixes_made > 0

def add_safe_print_helpers():
    """添加安全的打印辅助函数"""
    file_path = "start_quant_backend.py"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 在文件开头添加安全打印函数
    safe_print_function = """

# ===== 安全打印辅助函数 =====
def safe_print(text, max_length=500):
    \"\"\"安全打印，避免编码错误\"\"\"
    try:
        if isinstance(text, (dict, list)):
            text_str = str(text)
        else:
            text_str = str(text)
        
        # 截断并清理特殊字符
        safe_text = text_str[:max_length]
        # 移除可能导致编码问题的字符
        safe_text = ''.join(c for c in safe_text if ord(c) < 128 or c in '，。！？；：""')
        
        print(safe_text + ('...' if len(text_str) > max_length else ''))
    except:
        print(f'[安全打印] 无法打印内容: {type(text)}')


def safe_print_dict(data, prefix=''):
    \"\"\"安全打印字典\"\"\"
    if not isinstance(data, dict):
        safe_print(f'{prefix}{data}')
        return
    
    print(f'{prefix}{{')
    for key, value in list(data.items())[:10]:  # 只打印前10个键值对
        if isinstance(value, dict):
            print(f'{prefix}  {key}: {{...}}')
        elif isinstance(value, list):
            print(f'{prefix}  {key}: [{len(value)} items]')
        else:
            safe_print(f'{prefix}  {key}: {value}')
    if len(data) > 10:
        print(f'{prefix}  ... and {len(data)-10} more items')
    print(f'{prefix}}}')


def safe_print_news(news_data, prefix=''):
    \"\"\"安全打印新闻数据\"\"\"
    if not news_data:
        print(f'{prefix}No news data')
        return
    
    if isinstance(news_data, list):
        print(f'{prefix}News list with {len(news_data)} items')
        for i, item in enumerate(news_data[:3]):  # 只打印前3条
            if isinstance(item, dict):
                headline = item.get('headline', 'No headline')
                source = item.get('source', 'Unknown')
                safe_print(f'{prefix}  [{i+1}] {headline[:50]}... ({source})')
    elif isinstance(news_data, dict):
        safe_print_dict(news_data, prefix)
    else:
        safe_print(f'{prefix}{news_data}')

# ===== 安全打印辅助函数结束 =====

"""
    
    # 在import语句之后插入
    import_end = content.find("\n\n", content.find("import "))
    if import_end == -1:
        import_end = content.find("\n", content.find("import "))
    
    if import_end != -1:
        new_content = content[:import_end] + safe_print_function + content[import_end:]
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print("添加了安全打印辅助函数")
        return True
    else:
        print("未找到import语句位置")
        return False

def replace_unsafe_prints():
    """替换不安全的print语句"""
    file_path = "start_quant_backend.py"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 替换特定的print语句
    replacements = [
        # 新闻接口
        ("print(f'[新闻接口] 完整响应数据: {response_data}')", 
         "safe_print_news(response_data, '[新闻接口] 完整响应数据: ')"),
        
        # AI分析接口
        ("print(f'[AI分析接口] 新闻分析结果: {news_data}')", 
         "safe_print_news(news_data, '[AI分析接口] 新闻分析结果: ')"),
    ]
    
    fixes_made = 0
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            fixes_made += 1
            print(f"替换: {old[:50]}...")
    
    if fixes_made > 0:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"替换了 {fixes_made} 处不安全的print语句")
        return True
    else:
        print("未找到需要替换的print语句")
        return False

if __name__ == '__main__':
    print("开始修复编码问题...")
    
    # 添加安全打印辅助函数
    add_ok = add_safe_print_helpers()
    
    # 修复print语句
    fix_ok = fix_print_statements()
    
    # 替换不安全的print语句
    replace_ok = replace_unsafe_prints()
    
    print("\n" + "="*80)
    print("编码问题修复完成!")
    print("="*80)
    
    if add_ok or fix_ok or replace_ok:
        print("请重启后端服务以应用修复")
    else:
        print("无需修复")