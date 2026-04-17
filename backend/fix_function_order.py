#!/usr/bin/env python3
"""
修复start_quant_backend.py中的函数定义顺序问题
"""

import os

def fix_function_order():
    file_path = "start_quant_backend.py"
    
    print("读取文件...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 找到fetch_finnhub_news函数
    fetch_func_start = content.find("def fetch_finnhub_news(symbol):")
    if fetch_func_start == -1:
        print("错误: 未找到fetch_finnhub_news函数")
        return
    
    # 找到fetch_finnhub_news函数的结束
    # 查找下一个def或文件结尾
    next_def = content.find("\ndef ", fetch_func_start + 1)
    if next_def == -1:
        next_def = len(content)
    
    fetch_func = content[fetch_func_start:next_def]
    
    # 找到analyze_news_for_stock函数
    analyze_func_start = content.find("def analyze_news_for_stock(symbol):")
    if analyze_func_start == -1:
        print("错误: 未找到analyze_news_for_stock函数")
        return
    
    # 如果fetch_finnhub_news在analyze_news_for_stock之后，需要重新排序
    if fetch_func_start > analyze_func_start:
        print("检测到函数定义顺序问题: fetch_finnhub_news在analyze_news_for_stock之后")
        
        # 从原位置删除fetch_finnhub_news函数
        content_without_fetch = content[:fetch_func_start] + content[next_def:]
        
        # 在analyze_news_for_stock之前插入fetch_finnhub_news
        new_analyze_start = content_without_fetch.find("def analyze_news_for_stock(symbol):")
        
        # 插入点之前的内容
        before_analyze = content_without_fetch[:new_analyze_start]
        
        # 插入点之后的内容
        after_analyze = content_without_fetch[new_analyze_start:]
        
        # 重新组合内容
        fixed_content = before_analyze + fetch_func + "\n\n" + after_analyze
        
        # 备份原文件
        backup_path = file_path + ".backup"
        with open(backup_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"已创建备份: {backup_path}")
        
        # 写入修复后的文件
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(fixed_content)
        
        print("函数定义顺序已修复!")
        return True
    else:
        print("函数定义顺序正确")
        return False

if __name__ == '__main__':
    fix_function_order()