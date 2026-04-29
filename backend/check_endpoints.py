"""
检查后端文件中的接口
"""

import re

def check_endpoints():
    with open('start_quant_backend_repaired.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找Dashboard和Market需要的接口
    endpoints = [
        ('/market/stocks', 'GET'),
        ('/market/stock/', 'GET'),
        ('/system/status', 'GET'),
        ('/market/overview', 'GET')
    ]
    
    print('检查后端接口是否存在:')
    for endpoint, method in endpoints:
        # 查找@app.route定义
        pattern = r'@app\.route\([\"\']' + re.escape(endpoint) + r'[\"\'].*?\)\s*\ndef\s+\w+'
        match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
        if match:
            print(f'✓ 找到 {method} {endpoint}')
            # 提取函数名
            func_match = re.search(r'def\s+(\w+)', match.group(0))
            if func_match:
                print(f'  函数名: {func_match.group(1)}')
        else:
            print(f'✗ 未找到 {method} {endpoint}')
    
    # 检查是否有其他market相关接口
    print(f'\n查找所有market相关接口:')
    market_pattern = r'@app\.route\([\"\'](/market/[^\"\']+)[\"\'].*?\)'
    matches = re.findall(market_pattern, content)
    if matches:
        for endpoint in sorted(set(matches)):
            print(f'  {endpoint}')
    else:
        print('  未找到market接口')
    
    # 检查system相关接口
    print(f'\n查找所有system相关接口:')
    system_pattern = r'@app\.route\([\"\'](/system/[^\"\']+)[\"\'].*?\)'
    matches = re.findall(system_pattern, content)
    if matches:
        for endpoint in sorted(set(matches)):
            print(f'  {endpoint}')
    else:
        print('  未找到system接口')
    
    # 检查文件开头是否有Flask应用定义
    print(f'\n检查Flask应用定义:')
    if 'app = Flask(__name__)' in content:
        print('✓ 找到Flask应用定义')
    else:
        print('✗ 未找到Flask应用定义')
    
    # 检查文件结尾是否有启动代码
    print(f'\n检查启动代码:')
    if 'if __name__ == \'__main__\':' in content:
        print('✓ 找到启动代码')
        # 查看启动部分
        start_idx = content.find('if __name__ == \'__main__\':')
        if start_idx != -1:
            end_idx = min(start_idx + 500, len(content))
            print('启动代码片段:')
            print(content[start_idx:end_idx])
    else:
        print('✗ 未找到启动代码')

if __name__ == '__main__':
    check_endpoints()