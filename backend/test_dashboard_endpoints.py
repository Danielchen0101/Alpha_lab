"""
测试Dashboard和Market接口
"""

import requests
import json
import time

def test_endpoint(url, method='GET', data=None):
    print(f'\n测试接口: {method} {url}')
    print('='*50)
    
    try:
        start_time = time.time()
        
        if method == 'GET':
            response = requests.get(url, timeout=10)
        elif method == 'POST' and data:
            response = requests.post(url, json=data, timeout=10)
        else:
            print(f'不支持的请求方法: {method}')
            return False
        
        elapsed = time.time() - start_time
        
        print(f'响应状态码: {response.status_code}')
        print(f'响应时间: {elapsed:.2f}秒')
        
        if response.status_code == 200:
            data = response.json()
            print(f'响应数据 (摘要):')
            print(f'  success: {data.get("success")}')
            
            if 'stocks' in data:
                print(f'  股票数量: {len(data["stocks"])}')
                if data['stocks']:
                    print(f'  示例股票: {data["stocks"][0]["symbol"]} - ${data["stocks"][0]["price"]}')
            
            if 'status' in data:
                print(f'  系统状态: {data["status"]}')
            
            if 'message' in data:
                print(f'  消息: {data["message"]}')
            
            return True
        else:
            print(f'HTTP错误: {response.status_code}')
            print(f'响应内容: {response.text[:200]}')
            return False
            
    except requests.exceptions.ConnectionError:
        print(f'连接错误: 无法连接到 {url}')
        return False
    except requests.exceptions.Timeout:
        print(f'请求超时')
        return False
    except Exception as e:
        print(f'异常: {str(e)}')
        return False

def main():
    """主函数"""
    # 测试所有Dashboard和Market需要的接口
    endpoints = [
        ('http://127.0.0.1:8889/market/stocks', 'GET'),
        ('http://127.0.0.1:8889/market/stock/AAPL', 'GET'),
        ('http://127.0.0.1:8889/system/status', 'GET'),
        ('http://127.0.0.1:8889/market/overview', 'GET'),
        ('http://127.0.0.1:8889/health', 'GET')
    ]
    
    print('开始测试Dashboard和Market接口...')
    print('='*60)
    
    results = {}
    for url, method in endpoints:
        endpoint_name = url.split('/')[-1] if url.split('/')[-1] else url.split('/')[-2]
        success = test_endpoint(url, method)
        results[endpoint_name] = '成功' if success else '失败'
        time.sleep(0.5)  # 避免请求过快
    
    print(f'\n测试结果汇总:')
    print('='*60)
    for endpoint, result in results.items():
        print(f'{endpoint}: {result}')
    
    # 检查前端代理配置
    print(f'\n前端配置检查:')
    print('='*60)
    print('前端代理配置: http://127.0.0.1:8889')
    print('Dashboard请求路径: /api/market/stocks → http://127.0.0.1:8889/market/stocks')
    print('Market请求路径: /api/market/stock/AAPL → http://127.0.0.1:8889/market/stock/AAPL')
    
    # 测试前端代理路径
    print(f'\n测试前端代理路径:')
    print('='*60)
    
    # 注意：这里测试的是直接后端路径，不是前端代理路径
    # 前端实际请求的是 /api/market/stocks，会被代理到 http://127.0.0.1:8889/market/stocks
    
    print('前端请求流程:')
    print('1. 前端请求: GET /api/market/stocks')
    print('2. React代理: /api/* → http://127.0.0.1:8889/*')
    print('3. 实际请求: GET http://127.0.0.1:8889/market/stocks')
    print('4. 后端响应: 返回股票数据')
    
    # 验证所有接口都正常工作
    all_success = all(result == '成功' for result in results.values())
    if all_success:
        print(f'\n✅ 所有Dashboard和Market接口测试通过!')
        print('现在可以重新访问Dashboard和Market页面了。')
    else:
        print(f'\n❌ 部分接口测试失败，需要进一步排查。')

if __name__ == '__main__':
    main()