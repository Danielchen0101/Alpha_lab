"""
详细分析所有限制点
"""

import re

def analyze_limits():
    with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    print('详细分析所有限制点:')
    print('='*80)
    
    # 1. 查找所有timeout设置
    print('\n1. 所有timeout设置:')
    lines = content.split('\n')
    timeout_count = 0
    for i, line in enumerate(lines):
        if 'timeout' in line.lower() and '=' in line:
            timeout_count += 1
            if timeout_count <= 10:  # 只显示前10个
                print(f'  第{i+1}行: {line.strip()}')
    
    print(f'  总共找到 {timeout_count} 处timeout设置')
    
    # 2. 查找AI相关的具体限制
    print('\n2. AI分析相关限制:')
    
    # 查找analyze_trend_with_deepseek函数中的timeout
    deepseek_start = content.find('def analyze_trend_with_deepseek(')
    if deepseek_start != -1:
        next_def = content.find('\ndef ', deepseek_start + 1)
        if next_def == -1:
            next_def = len(content)
        
        deepseek_func = content[deepseek_start:next_def]
        deepseek_lines = deepseek_func.split('\n')
        
        print(f'  analyze_trend_with_deepseek函数:')
        
        # 查找timeout
        for i, line in enumerate(deepseek_lines):
            if 'timeout' in line.lower():
                print(f'    第{i+1}行 (相对): {line.strip()}')
        
        # 查找API密钥检查
        for i, line in enumerate(deepseek_lines):
            if 'api_key' in line.lower() and 'not' in line.lower():
                print(f'    API密钥检查: 第{i+1}行 (相对): {line.strip()}')
    
    # 3. 查找Alpaca限制
    print('\n3. Alpaca API限制:')
    
    # 查找Alpaca相关的常量
    alpaca_constants = []
    for i, line in enumerate(lines):
        if 'alpaca' in line.lower() and ('limit' in line.lower() or 'rate' in line.lower() or '200' in line or '100' in line):
            alpaca_constants.append((i, line))
    
    if alpaca_constants:
        print(f'  找到Alpaca相关限制:')
        for i, line in alpaca_constants[:5]:  # 只显示前5个
            print(f'    第{i+1}行: {line.strip()}')
    else:
        print(f'  未找到明显的Alpaca限制常量')
    
    # 4. 查找Finnhub限制
    print('\n4. Finnhub API限制:')
    
    # 查找Finnhub相关的常量
    finnhub_constants = []
    for i, line in enumerate(lines):
        if 'finnhub' in line.lower() and ('limit' in line.lower() or 'rate' in line.lower() or '60' in line or '30' in line):
            finnhub_constants.append((i, line))
    
    if finnhub_constants:
        print(f'  找到Finnhub相关限制:')
        for i, line in finnhub_constants[:5]:
            print(f'    第{i+1}行: {line.strip()}')
    else:
        print(f'  未找到明显的Finnhub限制常量')
    
    # 5. 查找数据不完整跳过逻辑
    print('\n5. 数据不完整跳过AI的逻辑:')
    
    # 在ai_analyze_single函数中查找
    ai_single_start = content.find('def ai_analyze_single():')
    if ai_single_start != -1:
        next_def = content.find('\ndef ', ai_single_start + 1)
        if next_def == -1:
            next_def = len(content)
        
        ai_func = content[ai_single_start:next_def]
        ai_lines = ai_func.split('\n')
        
        skip_patterns = [
            (r'if.*not.*market_data', '市场数据缺失跳过'),
            (r'if.*not.*company_info', '公司信息缺失跳过'),
            (r'if.*not.*news_data', '新闻数据缺失跳过'),
            (r'if.*None.*return', '返回None跳过'),
            (r'直接返回.*null', '直接返回null'),
            (r'skip.*ai', '跳过AI分析')
        ]
        
        for pattern, description in skip_patterns:
            for i, line in enumerate(ai_lines):
                if re.search(pattern, line, re.IGNORECASE):
                    print(f'  {description}: 第{i+1}行 (相对): {line.strip()[:80]}')
    
    # 6. 查找批处理和并发限制
    print('\n6. 批处理和并发限制:')
    
    # 查找ThreadPoolExecutor
    for i, line in enumerate(lines):
        if 'ThreadPoolExecutor' in line:
            print(f'  第{i+1}行: {line.strip()}')
            # 查看max_workers
            if i+1 < len(lines) and 'max_workers' in lines[i+1]:
                print(f'    第{i+2}行: {lines[i+1].strip()}')
    
    # 查找批处理大小
    for i, line in enumerate(lines):
        if 'batch' in line.lower() and ('size' in line.lower() or '10' in line or '20' in line):
            print(f'  可能包含批处理限制: 第{i+1}行: {line.strip()}')
    
    # 7. 查找前端限制
    print('\n7. 前端scanner限制 (需要检查Portfolio.tsx):')
    
    try:
        with open('../frontend/src/pages/Portfolio.tsx', 'r', encoding='utf-8') as f:
            frontend_content = f.read()
        
        # 查找scanSymbols函数
        scan_start = frontend_content.find('const scanSymbols')
        if scan_start != -1:
            # 找到函数结束
            scan_end = frontend_content.find('\n}', scan_start)
            if scan_end != -1:
                scan_func = frontend_content[scan_start:scan_end+2]
                scan_lines = scan_func.split('\n')
                
                print(f'  scanSymbols函数长度: {len(scan_lines)} 行')
                
                # 查找批处理
                for i, line in enumerate(scan_lines):
                    if 'slice' in line and ('10' in line or 'batch' in line.lower()):
                        print(f'    批处理限制: 第{i+1}行 (相对): {line.strip()}')
                
                # 查找并发控制
                for i, line in enumerate(scan_lines):
                    if 'Promise.all' in line or 'Promise.allSettled' in line:
                        print(f'    并发请求: 第{i+1}行 (相对): {line.strip()}')
                
                # 查找错误处理
                for i, line in enumerate(scan_lines):
                    if 'catch' in line or 'N/A' in line:
                        print(f'    错误处理: 第{i+1}行 (相对): {line.strip()[:80]}')
    
    except FileNotFoundError:
        print(f'  无法读取前端文件')

if __name__ == '__main__':
    analyze_limits()