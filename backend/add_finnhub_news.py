#!/usr/bin/env python3
"""
在start_quant_backend.py中添加fetch_finnhub_news函数
"""

import re

def add_fetch_finnhub_news():
    file_path = "start_quant_backend.py"
    
    print("读取文件...")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找analyze_news_for_stock函数
    analyze_pos = content.find("def analyze_news_for_stock(symbol):")
    if analyze_pos == -1:
        print("错误: 未找到analyze_news_for_stock函数")
        return False
    
    # 查找analyze_news_for_stock函数之前的位置
    # 向前查找空行
    insert_pos = analyze_pos
    while insert_pos > 0 and content[insert_pos-1] == '\n':
        insert_pos -= 1
    
    # 向前查找非空行
    while insert_pos > 0 and content[insert_pos-1] == '\n':
        insert_pos -= 1
    
    # 现在insert_pos指向analyze_news_for_stock函数之前的空行开始位置
    
    # 创建fetch_finnhub_news函数
    fetch_func = """

def fetch_finnhub_news(symbol):
    \"\"\"从Finnhub获取股票新闻\"\"\"
    try:
        print(f'[Finnhub新闻] 获取 {symbol} 新闻')
        
        # 检查API密钥
        if not FINNHUB_API_KEY:
            print(f'[Finnhub新闻] Finnhub API密钥未配置')
            return None
        
        # 调用Finnhub News API
        import requests
        from datetime import datetime, timedelta
        
        # 设置时间范围（最近7天）
        to_date = datetime.utcnow()
        from_date = to_date - timedelta(days=7)
        
        # 格式化日期
        from_str = from_date.strftime('%Y-%m-%d')
        to_str = to_date.strftime('%Y-%m-%d')
        
        # 构建API URL
        url = f'{FINNHUB_BASE_URL}/company-news'
        params = {
            'symbol': symbol,
            'from': from_str,
            'to': to_str,
            'token': FINNHUB_API_KEY
        }
        
        print(f'[Finnhub新闻] 请求URL: {url}')
        print(f'[Finnhub新闻] 参数: {params}')
        
        # 发送请求
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            news_data = response.json()
            print(f'[Finnhub新闻] 获取到 {len(news_data)} 条新闻')
            return news_data
        else:
            print(f'[Finnhub新闻] API请求失败: {response.status_code}')
            print(f'[Finnhub新闻] 响应: {response.text[:200]}')
            return None
            
    except Exception as e:
        print(f'[Finnhub新闻] 获取新闻时出错: {str(e)}')
        return None
"""
    
    # 插入函数
    new_content = content[:insert_pos] + fetch_func + content[insert_pos:]
    
    # 备份原文件
    backup_path = file_path + ".backup_news"
    with open(backup_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"已创建备份: {backup_path}")
    
    # 写入新文件
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("成功添加fetch_finnhub_news函数!")
    
    # 验证添加是否成功
    with open(file_path, 'r', encoding='utf-8') as f:
        new_content_check = f.read()
    
    if "def fetch_finnhub_news(symbol):" in new_content_check:
        print("验证: fetch_finnhub_news函数已成功添加")
        return True
    else:
        print("错误: fetch_finnhub_news函数添加失败")
        return False

if __name__ == '__main__':
    add_fetch_finnhub_news()