import requests
import json

print("测试前端代理连通性...")
print(f"前端地址: http://localhost:3000")
print(f"代理配置: http://127.0.0.1:8890")
print()

# 测试通过前端代理访问后端API
test_cases = [
    {"path": "/api/status", "desc": "系统状态"},
    {"path": "/api/market/stocks", "desc": "股票列表"},
    {"path": "/api/market/history/AAPL?interval=D&range=1month", "desc": "AAPL历史数据"},
    {"path": "/api/market/stock/AAPL", "desc": "AAPL单股详情"},
]

for test in test_cases:
    print(f"测试: {test['desc']}")
    print(f"  请求: http://localhost:3000{test['path']}")
    
    try:
        r = requests.get(f"http://localhost:3000{test['path']}", timeout=10)
        print(f"  状态码: {r.status_code}")
        
        if r.status_code == 200:
            try:
                data = r.json()
                print(f"  成功! 响应类型: {type(data)}")
                
                if test['path'] == '/api/status':
                    print(f"    状态: {data.get('status')}")
                    print(f"    数据源: {data.get('dataSource')}")
                elif test['path'] == '/api/market/stocks':
                    print(f"    股票数量: {data.get('count', 0)}")
                elif 'history' in test['path']:
                    print(f"    数据条数: {data.get('count', 0)}")
                    print(f"    数据源: {data.get('dataSource')}")
                elif 'stock' in test['path']:
                    print(f"    名称: {data.get('name')}")
                    print(f"    价格: ${data.get('price')}")
            except:
                print(f"  响应不是JSON格式: {r.text[:100]}")
        elif r.status_code == 404:
            print(f"  404 Not Found - 可能代理配置有问题")
        elif r.status_code == 500:
            print(f"  500 Internal Server Error - 后端错误")
            print(f"  响应: {r.text[:200]}")
        else:
            print(f"  其他错误: {r.status_code}")
            print(f"  响应: {r.text[:200]}")
            
    except requests.exceptions.ConnectionError as e:
        print(f"  连接失败: {e}")
        print(f"  可能原因:")
        print(f"    1. 前端开发服务器未运行")
        print(f"    2. 代理配置错误")
        print(f"    3. 网络问题")
    except Exception as e:
        print(f"  请求失败: {e}")
    
    print()

print("="*60)
print("代理测试总结:")
print("如果所有测试都通过，说明:")
print("1. ✅ 前端开发服务器运行正常")
print("2. ✅ 代理配置正确 (package.json中的proxy)")
print("3. ✅ 后端服务可访问")
print()
print("如果测试失败，检查:")
print("1. 前端package.json中的proxy配置")
print("2. 后端是否在8890端口运行")
print("3. 防火墙或网络设置")