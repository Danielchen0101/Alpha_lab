"""
简单检查路由定义
"""

def check_routes():
    with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 要检查的路由
    routes_to_check = [
        '/system/status',
        '/api/status',
        '/market/stocks',
        '/api/market/stocks',
        '/market/stock/',
        '/api/market/stock/'
    ]
    
    print('检查路由定义:')
    print('='*60)
    
    for route in routes_to_check:
        # 简单查找
        search_pattern = f'@app.route(\"{route}'
        if search_pattern in content:
            print(f'[找到] {route}')
            
            # 找到位置
            idx = content.find(search_pattern)
            start = max(0, idx - 100)
            end = min(len(content), idx + 200)
            context = content[start:end]
            
            # 提取函数名
            lines = context.split('\n')
            for line in lines:
                if line.strip().startswith('def '):
                    print(f'  函数: {line.strip()}')
                    break
        else:
            print(f'[未找到] {route}')

if __name__ == '__main__':
    check_routes()