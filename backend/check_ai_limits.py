"""
详细检查AI分析相关的限制
"""

def check_ai_limits():
    with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    print('详细检查AI分析限制:')
    print('='*80)
    
    # 1. 查找ai_analyze_single函数
    print('\n1. ai_analyze_single函数:')
    ai_start = content.find('def ai_analyze_single():')
    if ai_start != -1:
        # 找到函数结束
        next_def = content.find('\ndef ', ai_start + 1)
        if next_def == -1:
            next_def = len(content)
        
        ai_func = content[ai_start:next_def]
        lines = ai_func.split('\n')
        
        print(f'  函数长度: {len(lines)} 行')
        
        # 检查timeout
        timeout_lines = [i for i, line in enumerate(lines) if 'timeout' in line.lower()]
        if timeout_lines:
            print(f'  找到timeout限制:')
            for line_num in timeout_lines[:3]:  # 只显示前3个
                print(f'    第{line_num+1}行: {lines[line_num].strip()}')
        
        # 检查skip逻辑
        skip_keywords = ['if not', 'return None', 'skip', '直接返回', '跳过', 'market_data is None', 'company_info is None', 'news_data is None']
        skip_lines = []
        for i, line in enumerate(lines):
            for keyword in skip_keywords:
                if keyword in line.lower():
                    skip_lines.append((i, line))
                    break
        
        if skip_lines:
            print(f'  找到跳过逻辑:')
            for line_num, line in skip_lines[:5]:  # 只显示前5个
                print(f'    第{line_num+1}行: {line.strip()}')
        
        # 检查并发限制
        concurrent_keywords = ['ThreadPoolExecutor', 'max_workers', 'concurrent', '并发']
        for i, line in enumerate(lines):
            for keyword in concurrent_keywords:
                if keyword in line:
                    print(f'  找到并发控制: 第{i+1}行: {line.strip()}')
    
    # 2. 查找analyze_trend_with_deepseek函数
    print('\n2. analyze_trend_with_deepseek函数:')
    deepseek_start = content.find('def analyze_trend_with_deepseek(')
    if deepseek_start != -1:
        # 找到函数结束
        next_def = content.find('\ndef ', deepseek_start + 1)
        if next_def == -1:
            next_def = len(content)
        
        deepseek_func = content[deepseek_start:next_def]
        lines = deepseek_func.split('\n')
        
        print(f'  函数长度: {len(lines)} 行')
        
        # 检查timeout
        timeout_lines = [i for i, line in enumerate(lines) if 'timeout' in line.lower()]
        if timeout_lines:
            print(f'  找到timeout限制:')
            for line_num in timeout_lines:
                print(f'    第{line_num+1}行: {lines[line_num].strip()}')
        
        # 检查API密钥验证
        api_key_lines = [i for i, line in enumerate(lines) if 'api_key' in line.lower() or 'apikey' in line.lower()]
        if api_key_lines:
            print(f'  API密钥检查:')
            for line_num in api_key_lines[:3]:
                print(f'    第{line_num+1}行: {lines[line_num].strip()}')
    
    # 3. 查找Alpaca数据获取限制
    print('\n3. Alpaca数据获取限制:')
    
    # 查找fetch_alpaca_stock_data函数
    alpaca_start = content.find('def fetch_alpaca_stock_data(')
    if alpaca_start != -1:
        next_def = content.find('\ndef ', alpaca_start + 1)
        if next_def == -1:
            next_def = len(content)
        
        alpaca_func = content[alpaca_start:next_def]
        
        # 检查rate limit
        if 'rate' in alpaca_func.lower() and 'limit' in alpaca_func.lower():
            print(f'  找到rate limit限制')
        
        # 检查sleep/throttle
        if 'sleep' in alpaca_func.lower() or 'throttle' in alpaca_func.lower():
            print(f'  找到sleep/throttle限制')
        
        # 显示函数前20行
        lines = alpaca_func.split('\n')
        print(f'  函数前20行:')
        for i in range(min(20, len(lines))):
            print(f'    {i+1}: {lines[i].strip()}')
    
    # 4. 查找Finnhub限制
    print('\n4. Finnhub限制:')
    
    # 查找fetch_finnhub_profile函数
    finnhub_start = content.find('def fetch_finnhub_profile(')
    if finnhub_start != -1:
        next_def = content.find('\ndef ', finnhub_start + 1)
        if next_def == -1:
            next_def = len(content)
        
        finnhub_func = content[finnhub_start:next_def]
        
        # 检查rate limit
        if 'rate' in finnhub_func.lower() and 'limit' in finnhub_func.lower():
            print(f'  找到rate limit限制')
        
        # 检查sleep/throttle
        if 'sleep' in finnhub_func.lower() or 'throttle' in finnhub_func.lower():
            print(f'  找到sleep/throttle限制')
        
        # 检查timeout
        if 'timeout' in finnhub_func.lower():
            print(f'  找到timeout限制')
        
        # 显示函数前20行
        lines = finnhub_func.split('\n')
        print(f'  函数前20行:')
        for i in range(min(20, len(lines))):
            print(f'    {i+1}: {lines[i].strip()}')
    
    # 5. 查找全局配置
    print('\n5. 全局配置和常量:')
    
    # 查找常量定义
    constant_patterns = [
        'ALPACA_RATE_LIMIT',
        'FINNHUB_RATE_LIMIT', 
        'MAX_CONCURRENT',
        'BATCH_SIZE',
        'TIMEOUT',
        'RETRY_COUNT'
    ]
    
    lines = content.split('\n')
    for i, line in enumerate(lines):
        for pattern in constant_patterns:
            if pattern in line:
                print(f'  第{i+1}行: {line.strip()}')
    
    # 6. 查找前端scanner相关代码
    print('\n6. 前端scanner限制 (Portfolio.tsx):')
    try:
        with open('../frontend/src/pages/Portfolio.tsx', 'r', encoding='utf-8') as f:
            frontend_content = f.read()
        
        # 查找scanSymbols函数
        if 'scanSymbols' in frontend_content:
            print(f'  找到scanSymbols函数')
            
            # 查找批处理大小
            batch_patterns = ['batch.*size', 'slice.*10', '10.*symbol', 'Promise.all']
            for pattern in batch_patterns:
                if re.search(pattern, frontend_content, re.IGNORECASE):
                    print(f'    可能包含批处理限制: {pattern}')
            
            # 查找并发控制
            if 'limitConcurrency' in frontend_content:
                print(f'    使用limitConcurrency进行并发控制')
            
            # 查找错误处理
            if 'catch' in frontend_content and 'N/A' in frontend_content:
                print(f'    有错误处理并返回N/A的逻辑')
    
    except FileNotFoundError:
        print(f'  无法找到前端文件')

if __name__ == '__main__':
    check_ai_limits()