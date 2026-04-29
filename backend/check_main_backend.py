"""
检查主后端文件中的接口
"""

import re

def check_main_backend():
    with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找Dashboard和Market需要的接口
    endpoints = [
        ('/market/stocks', 'GET'),
        ('/market/stock/', 'GET'),
        ('/system/status', 'GET'),
        ('/market/overview', 'GET')
    ]
    
    print('检查主后端接口是否存在:')
    for endpoint, method in endpoints:
        # 查找@app.route定义
        pattern = r'@app\.route\([\"\']' + re.escape(endpoint) + r'[\"\'].*?\)\s*\ndef\s+\w+'
        match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if match:
            print(f'[成功] 找到 {method} {endpoint}')
            # 提取函数名
            func_match = re.search(r'def\s+(\w+)', match.group(0))
            if func_match:
                print(f'  函数名: {func_match.group(1)}')
        else:
            print(f'[失败] 未找到 {method} {endpoint}')
    
    # 检查是否有其他market相关接口
    print(f'\n查找所有market相关接口:')
    market_pattern = r'@app\.route\([\"\'](/market/[^\"\']+)[\"\'].*?\)'
    matches = re.findall(market_pattern, content)
    if matches:
        for endpoint in sorted(set(matches)):
            print(f'  {endpoint}')
    else:
        print('  未找到market接口')
    
    # 检查是否有system相关接口
    print(f'\n查找所有system相关接口:')
    system_pattern = r'@app\.route\([\"\'](/system/[^\"\']+)[\"\'].*?\)'
    matches = re.findall(system_pattern, content)
    if matches:
        for endpoint in sorted(set(matches)):
            print(f'  {endpoint}')
    else:
        print('  未找到system接口')
    
    # 检查是否有api前缀的接口
    print(f'\n查找所有api前缀接口:')
    api_pattern = r'@app\.route\([\"\'](/api/[^\"\']+)[\"\'].*?\)'
    matches = re.findall(api_pattern, content)
    if matches:
        for endpoint in sorted(set(matches)):
            print(f'  {endpoint}')
    else:
        print('  未找到api前缀接口')
    
    # 检查文件开头
    print(f'\n检查文件开头:')
    lines = content.split('\n')
    for i in range(min(20, len(lines))):
        print(f'{i+1:3}: {lines[i]}')
    
    # 检查文件结尾
    print(f'\n检查文件结尾:')
    for i in range(max(0, len(lines)-20), len(lines)):
        print(f'{i+1:3}: {lines[i]}')

if __name__ == '__main__':
    check_main_backend()