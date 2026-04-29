"""
测试真实前端请求路径
"""

import requests
import time

def test_real_requests():
    """测试前端实际请求的路径"""
    
    print('测试前端实际请求的路径:')
    print('='*60)
    
    # 前端实际请求的路径（根据api.ts配置）
    frontend_paths = [
        '/system/status',           # Dashboard使用的系统状态
        '/market/stocks',           # Dashboard和Market使用的股票列表
        '/market/stock/AAPL',       # Market使用的单个股票
        '/api/status',              # 后端实际有的系统状态接口
        '/api/market/stocks',       # 后端实际有的股票列表接口
        '/api/market/stock/AAPL',   # 后端实际有的单个股票接口
        '/health'                   # 健康检查
    ]
    
    results = {}
    
    for path in frontend_paths:
        url = f'http://127.0.0.1:8889{path}'
        print(f'\n测试: {path}')
        print('-'*40)
        
        try:
            start_time = time.time()
            response = requests.get(url, timeout=10)
            elapsed = time.time() - start_time
            
            print(f'URL: {url}')
            print(f'状态码: {response.status_code}')
            print(f'响应时间: {elapsed:.2f}秒')
            
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', 'N/A')
                print(f'success: {success}')
                
                if 'stocks' in data:
                    print(f'股票数量: {len(data["stocks"])}')
                
                if 'status' in data:
                    print(f'状态: {data["status"]}')
                
                results[path] = '成功'
            else:
                print(f'错误: {response.status_code}')
                print(f'响应: {response.text[:200]}')
                results[path] = '失败'
                
        except requests.exceptions.ConnectionError:
            print(f'连接错误: 无法连接到后端')
            results[path] = '连接错误'
        except requests.exceptions.Timeout:
            print(f'请求超时')
            results[path] = '超时'
        except Exception as e:
            print(f'异常: {str(e)}')
            results[path] = '异常'
        
        time.sleep(0.5)
    
    # 分析结果
    print(f'\n\n结果分析:')
    print('='*60)
    
    print('\n前端配置请求的路径:')
    print('-'*40)
    frontend_paths_to_check = ['/system/status', '/market/stocks', '/market/stock/AAPL']
    for path in frontend_paths_to_check:
        result = results.get(path, '未测试')
        print(f'{path}: {result}')
    
    print('\n后端实际有的路径:')
    print('-'*40)
    backend_paths_to_check = ['/api/status', '/api/market/stocks', '/api/market/stock/AAPL']
    for path in backend_paths_to_check:
        result = results.get(path, '未测试')
        print(f'{path}: {result}')
    
    # 找出不匹配的路径
    print('\n路径不匹配分析:')
    print('-'*40)
    
    # 前端请求 vs 后端实际
    mismatches = []
    for frontend_path in frontend_paths_to_check:
        if frontend_path in results and results[frontend_path] != '成功':
            # 检查是否有对应的API路径
            api_path = frontend_path.replace('/market/', '/api/market/').replace('/system/', '/api/')
            if api_path in results and results[api_path] == '成功':
                mismatches.append((frontend_path, api_path))
    
    if mismatches:
        print('发现路径不匹配:')
        for frontend_path, api_path in mismatches:
            print(f'  前端请求: {frontend_path} (失败)')
            print(f'  后端实际: {api_path} (成功)')
            print(f'  解决方案: 前端应该请求 {api_path} 而不是 {frontend_path}')
    else:
        print('所有路径都匹配')
    
    # 建议修复方案
    print('\n建议修复方案:')
    print('-'*40)
    
    if '/system/status' in results and results['/system/status'] != '成功':
        if '/api/status' in results and results['/api/status'] == '成功':
            print('1. 修改前端 systemAPI.getSystemStatus() 请求路径:')
            print('   从: /system/status')
            print('   到: /api/status')
    
    if '/market/stocks' in results and results['/market/stocks'] != '成功':
        if '/api/market/stocks' in results and results['/api/market/stocks'] == '成功':
            print('2. 修改前端 marketAPI.getStocks() 请求路径:')
            print('   从: /market/stocks')
            print('   到: /api/market/stocks')
    
    if '/market/stock/AAPL' in results and results['/market/stock/AAPL'] != '成功':
        if '/api/market/stock/AAPL' in results and results['/api/market/stock/AAPL'] == '成功':
            print('3. 修改前端 marketAPI.getStockData() 请求路径:')
            print('   从: /market/stock/{symbol}')
            print('   到: /api/market/stock/{symbol}')

if __name__ == '__main__':
    test_real_requests()