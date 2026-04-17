"""
最终测试修复后的接口
"""

import requests
import time
import json

def test_endpoint(path, expected_status=200):
    """测试单个接口"""
    url = f'http://127.0.0.1:8889{path}'
    
    try:
        print(f'测试: {path}')
        print('-'*40)
        
        start_time = time.time()
        response = requests.get(url, timeout=10)
        elapsed = time.time() - start_time
        
        print(f'URL: {url}')
        print(f'状态码: {response.status_code} (期望: {expected_status})')
        print(f'响应时间: {elapsed:.2f}秒')
        
        if response.status_code == expected_status:
            if response.status_code == 200:
                data = response.json()
                success = data.get('success', 'N/A')
                print(f'success: {success}')
                
                if 'stocks' in data:
                    print(f'股票数量: {len(data["stocks"])}')
                    if data['stocks']:
                        print(f'示例: {data["stocks"][0]["symbol"]} - ${data["stocks"][0]["price"]}')
                
                if 'status' in data:
                    print(f'状态: {data["status"]}')
                
                if 'symbol' in data:
                    print(f'股票: {data["symbol"]} - ${data.get("price", "N/A")}')
            
            return True
        else:
            print(f'错误响应: {response.text[:200]}')
            return False
            
    except Exception as e:
        print(f'异常: {str(e)}')
        return False

def main():
    """主测试函数"""
    print('测试修复后的Dashboard和Market接口')
    print('='*60)
    
    # Dashboard和Market实际使用的接口
    endpoints = [
        ('/system/status', 200),      # Dashboard系统状态
        ('/market/stocks', 200),      # Dashboard和Market股票列表
        ('/market/stock/AAPL', 200),  # Market单个股票
        ('/api/status', 200),         # API版本系统状态
        ('/api/market/stocks', 200),  # API版本股票列表
        ('/api/market/stock/AAPL', 200),  # API版本单个股票
        ('/health', 200)              # 健康检查
    ]
    
    results = {}
    
    for path, expected_status in endpoints:
        success = test_endpoint(path, expected_status)
        results[path] = '成功' if success else '失败'
        print()
        time.sleep(0.5)
    
    # 分析结果
    print('测试结果汇总:')
    print('='*60)
    
    print('\n前端实际请求的接口:')
    print('-'*40)
    frontend_endpoints = ['/system/status', '/market/stocks', '/market/stock/AAPL']
    for path in frontend_endpoints:
        print(f'{path}: {results.get(path, "未测试")}')
    
    print('\nAPI版本接口:')
    print('-'*40)
    api_endpoints = ['/api/status', '/api/market/stocks', '/api/market/stock/AAPL']
    for path in api_endpoints:
        print(f'{path}: {results.get(path, "未测试")}')
    
    # 检查是否所有前端接口都成功
    frontend_success = all(results.get(path) == '成功' for path in frontend_endpoints)
    
    if frontend_success:
        print(f'\n✅ 所有前端接口测试成功!')
        print('Dashboard和Market页面应该可以正常工作了。')
    else:
        print(f'\n❌ 部分前端接口测试失败。')
        
        # 找出失败的原因
        for path in frontend_endpoints:
            if results.get(path) != '成功':
                print(f'  失败接口: {path}')
                
                # 检查对应的API版本
                api_path = path.replace('/market/', '/api/market/').replace('/system/', '/api/')
                if api_path in results:
                    print(f'  对应API接口 {api_path}: {results[api_path]}')

if __name__ == '__main__':
    main()