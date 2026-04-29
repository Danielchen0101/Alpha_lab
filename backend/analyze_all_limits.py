"""
全面分析所有AI、Alpaca、Finnhub限制点
"""

import re
import json

def analyze_all_limits():
    with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    print('全面分析所有限制点')
    print('='*80)
    
    lines = content.split('\n')
    
    # 1. 查找所有timeout设置
    print('\n1. AI调用相关timeout设置:')
    ai_timeouts = []
    for i, line in enumerate(lines):
        if 'timeout' in line.lower() and '=' in line:
            # 检查是否在AI相关函数中
            context_start = max(0, i-20)
            context = '\n'.join(lines[context_start:i+5])
            
            # 检查是否在AI相关函数中
            ai_functions = ['analyze_trend_with_deepseek', 'ai_analyze_single', 'deepseek']
            if any(func in context for func in ai_functions):
                ai_timeouts.append((i, line))
    
    if ai_timeouts:
        for i, line in ai_timeouts:
            print(f'  第{i+1}行: {line.strip()}')
            # 显示函数名
            for j in range(max(0, i-10), i):
                if 'def ' in lines[j]:
                    print(f'    所在函数: {lines[j].strip()}')
                    break
    else:
        print('  未找到AI相关timeout设置')
    
    # 2. 查找Alpaca限制
    print('\n2. Alpaca API限制:')
    alpaca_limits = []
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if 'alpaca' in line_lower:
            # 检查是否有限制相关关键词
            limit_keywords = ['limit', 'rate', 'sleep', 'throttle', 'wait', 'delay', '200', '100', 'min', 'second']
            if any(keyword in line_lower for keyword in limit_keywords):
                alpaca_limits.append((i, line))
    
    if alpaca_limits:
        for i, line in alpaca_limits[:10]:  # 只显示前10个
            print(f'  第{i+1}行: {line.strip()}')
    else:
        print('  未找到明显的Alpaca限制设置')
    
    # 3. 查找Finnhub限制
    print('\n3. Finnhub API限制:')
    finnhub_limits = []
    for i, line in enumerate(lines):
        line_lower = line.lower()
        if 'finnhub' in line_lower:
            # 检查是否有限制相关关键词
            limit_keywords = ['limit', 'rate', 'sleep', 'throttle', 'wait', 'delay', '60', '30', 'min', 'second']
            if any(keyword in line_lower for keyword in limit_keywords):
                finnhub_limits.append((i, line))
    
    if finnhub_limits:
        for i, line in finnhub_limits[:10]:  # 只显示前10个
            print(f'  第{i+1}行: {line.strip()}')
    else:
        print('  未找到明显的Finnhub限制设置')
    
    # 4. 查找数据不完整跳过逻辑
    print('\n4. 数据不完整跳过AI的逻辑:')
    
    # 查找ai_analyze_single函数
    ai_start = content.find('def ai_analyze_single():')
    if ai_start != -1:
        next_def = content.find('\ndef ', ai_start + 1)
        if next_def == -1:
            next_def = len(content)
        
        ai_func = content[ai_start:next_def]
        ai_lines = ai_func.split('\n')
        
        skip_patterns = [
            (r'if.*not.*market_data.*:', '市场数据缺失'),
            (r'if.*market_data.*is.*None.*:', '市场数据为None'),
            (r'if.*not.*company_info.*:', '公司信息缺失'),
            (r'if.*not.*news_data.*:', '新闻数据缺失'),
            (r'if.*not.*history_data.*:', '历史数据缺失'),
            (r'return.*None', '返回None'),
            (r'return.*null', '返回null'),
            (r'直接跳过', '直接跳过'),
            (r'skip.*ai', '跳过AI')
        ]
        
        found_skips = []
        for pattern, description in skip_patterns:
            for i, line in enumerate(ai_lines):
                if re.search(pattern, line, re.IGNORECASE):
                    found_skips.append((i, description, line))
        
        if found_skips:
            for i, description, line in found_skips[:10]:  # 只显示前10个
                print(f'  第{i+1}行 (相对): {description}: {line.strip()[:80]}')
        else:
            print('  未找到明显的跳过逻辑')
    else:
        print('  未找到ai_analyze_single函数')
    
    # 5. 查找并发控制
    print('\n5. 并发控制设置:')
    
    # 查找ThreadPoolExecutor
    threadpool_count = 0
    for i, line in enumerate(lines):
        if 'ThreadPoolExecutor' in line:
            threadpool_count += 1
            print(f'  第{i+1}行: {line.strip()}')
            # 查找max_workers
            for j in range(i, min(i+5, len(lines))):
                if 'max_workers' in lines[j]:
                    print(f'    第{j+1}行: {lines[j].strip()}')
    
    if threadpool_count == 0:
        print('  未找到ThreadPoolExecutor')
    
    # 6. 查找批处理设置
    print('\n6. 批处理设置:')
    
    # 在前端代码中查找
    try:
        with open('../frontend/src/pages/Portfolio.tsx', 'r', encoding='utf-8') as f:
            frontend_content = f.read()
        
        # 查找BATCH_SIZE
        if 'BATCH_SIZE' in frontend_content:
            idx = frontend_content.find('BATCH_SIZE')
            start = max(0, idx - 50)
            end = min(len(frontend_content), idx + 50)
            context = frontend_content[start:end]
            print(f'  前端BATCH_SIZE设置: {context.strip()}')
        
        # 查找slice操作
        slice_matches = re.findall(r'slice.*\d+', frontend_content)
        if slice_matches:
            print(f'  前端slice操作: {slice_matches[0]}')
        
        # 查找Promise.all或Promise.allSettled
        if 'Promise.all' in frontend_content:
            print(f'  使用Promise.all进行并发处理')
        if 'Promise.allSettled' in frontend_content:
            print(f'  使用Promise.allSettled进行并发处理')
    
    except FileNotFoundError:
        print('  无法读取前端文件')
    
    # 7. 查找错误处理
    print('\n7. 错误处理逻辑:')
    
    # 在ai_analyze_single中查找try-catch
    if ai_start != -1:
        ai_func = content[ai_start:next_def]
        
        # 统计try-catch数量
        try_count = ai_func.count('try:')
        catch_count = ai_func.count('except')
        print(f'  ai_analyze_single函数中:')
        print(f'    try块数量: {try_count}')
        print(f'    except块数量: {catch_count}')
        
        # 查找返回错误信息的逻辑
        error_patterns = [
            r'return.*error',
            r'return.*失败',
            r'print.*error',
            r'print.*失败',
            r'logger.*error'
        ]
        
        error_lines = []
        ai_lines = ai_func.split('\n')
        for i, line in enumerate(ai_lines):
            for pattern in error_patterns:
                if re.search(pattern, line, re.IGNORECASE):
                    error_lines.append((i, line))
                    break
        
        if error_lines:
            print(f'  错误处理相关代码:')
            for i, line in error_lines[:5]:  # 只显示前5个
                print(f'    第{i+1}行 (相对): {line.strip()[:80]}')
    
    # 8. 总结
    print('\n8. 限制点总结:')
    print('-'*40)
    
    summary = {
        'ai_timeouts': len(ai_timeouts),
        'alpaca_limits': len(alpaca_limits),
        'finnhub_limits': len(finnhub_limits),
        'threadpool_instances': threadpool_count,
        'skip_logic_found': len(found_skips) if 'found_skips' in locals() else 0
    }
    
    for key, value in summary.items():
        print(f'  {key}: {value}')
    
    print('\n需要检查的关键问题:')
    print('  1. AI调用是否有timeout限制')
    print('  2. Alpaca是否有rate limit设置')
    print('  3. Finnhub是否有rate limit设置')
    print('  4. 数据不完整时是否跳过AI分析')
    print('  5. 错误是否被静默处理')

if __name__ == '__main__':
    analyze_all_limits()