"""
查找所有AI、Alpaca、Finnhub的限制点
"""

import re

def find_limits():
    with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    print('查找所有限制点:')
    print('='*80)
    
    # 1. 查找scanner批处理大小
    print('\n1. Scanner批处理大小:')
    scanner_patterns = [
        r'batch.*size',
        r'batch.*\d+',
        r'symbols.*slice',
        r'limit.*\d+.*symbol',
        r'concurrent.*\d+'
    ]
    
    for pattern in scanner_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        if matches:
            print(f'  找到 {pattern}: {len(matches)} 处')
            # 显示上下文
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if re.search(pattern, line, re.IGNORECASE):
                    print(f'    第{i+1}行: {line.strip()[:100]}')
    
    # 2. 查找AI调用相关限制
    print('\n2. AI调用限制:')
    ai_patterns = [
        r'timeout.*\d+',
        r'timeout=',
        r'并发.*\d+',
        r'concurrent.*ai',
        r'rate.*limit.*ai',
        r'skip.*ai',
        r'跳过.*ai',
        r'if.*not.*data.*return',
        r'if.*None.*return'
    ]
    
    for pattern in ai_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        if matches:
            print(f'  找到 {pattern}: {len(matches)} 处')
    
    # 3. 查找Alpaca限制
    print('\n3. Alpaca限制:')
    alpaca_patterns = [
        r'alpaca.*rate.*limit',
        r'alpaca.*\d+.*min',
        r'alpaca.*\d+.*second',
        r'200.*min.*alpaca',
        r'limit.*alpaca',
        r'sleep.*alpaca',
        r'time.sleep.*alpaca',
        r'throttle.*alpaca'
    ]
    
    for pattern in alpaca_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        if matches:
            print(f'  找到 {pattern}: {len(matches)} 处')
            # 显示上下文
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if re.search(pattern, line, re.IGNORECASE):
                    print(f'    第{i+1}行: {line.strip()[:100]}')
    
    # 4. 查找Finnhub限制
    print('\n4. Finnhub限制:')
    finnhub_patterns = [
        r'finnhub.*rate.*limit',
        r'finnhub.*\d+.*min',
        r'60.*min.*finnhub',
        r'30.*sec.*finnhub',
        r'limit.*finnhub',
        r'sleep.*finnhub',
        r'time.sleep.*finnhub',
        r'throttle.*finnhub'
    ]
    
    for pattern in finnhub_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        if matches:
            print(f'  找到 {pattern}: {len(matches)} 处')
            # 显示上下文
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if re.search(pattern, line, re.IGNORECASE):
                    print(f'    第{i+1}行: {line.strip()[:100]}')
    
    # 5. 查找请求重试逻辑
    print('\n5. 请求重试逻辑:')
    retry_patterns = [
        r'retry.*\d+',
        r'重试.*\d+',
        r'for.*in.*range.*\d+',
        r'try.*except.*continue',
        r'429.*retry',
        r'rate.*limit.*retry'
    ]
    
    for pattern in retry_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        if matches:
            print(f'  找到 {pattern}: {len(matches)} 处')
    
    # 6. 查找数据不完整跳过逻辑
    print('\n6. 数据不完整跳过逻辑:')
    skip_patterns = [
        r'if.*not.*data',
        r'if.*None.*skip',
        r'if.*empty.*return',
        r'if.*len.*==.*0.*return',
        r'if.*not.*market.*data.*return',
        r'if.*not.*news.*return',
        r'if.*not.*history.*return',
        r'直接返回.*null',
        r'直接跳过.*ai'
    ]
    
    for pattern in skip_patterns:
        matches = re.findall(pattern, content, re.IGNORECASE)
        if matches:
            print(f'  找到 {pattern}: {len(matches)} 处')
            # 显示前3个匹配
            lines = content.split('\n')
            count = 0
            for i, line in enumerate(lines):
                if re.search(pattern, line, re.IGNORECASE):
                    print(f'    第{i+1}行: {line.strip()[:100]}')
                    count += 1
                    if count >= 3:
                        break
    
    # 7. 查找具体的函数定义
    print('\n7. 关键函数定义:')
    functions_to_find = [
        'ai_analyze_single',
        'analyze_trend_with_deepseek',
        'fetch_alpaca_stock_data',
        'fetch_finnhub_profile',
        'fetch_finnhub_news',
        'get_stock_data_for_scanner'
    ]
    
    for func in functions_to_find:
        if f'def {func}' in content:
            print(f'  找到函数: {func}')
            # 找到函数位置
            idx = content.find(f'def {func}')
            start = max(0, idx - 200)
            end = min(len(content), idx + 500)
            func_section = content[start:end]
            
            # 检查是否有timeout
            if 'timeout' in func_section.lower():
                print(f'    包含timeout限制')
            
            # 检查是否有skip逻辑
            skip_keywords = ['if not', 'return None', 'skip', '直接返回', '跳过']
            for keyword in skip_keywords:
                if keyword in func_section:
                    print(f'    可能包含跳过逻辑: {keyword}')
                    break

if __name__ == '__main__':
    find_limits()