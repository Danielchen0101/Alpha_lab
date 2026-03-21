import requests

print("测试前端实际请求的URL...")

# 前端实际请求的URL（根据代码分析）
test_cases = [
    {
        "url": "http://127.0.0.1:8890/api/market/history/AAPL",
        "params": {"interval": "60", "range": "1day"},
        "desc": "1 Day数据 (interval=60, range=1day)"
    },
    {
        "url": "http://127.0.0.1:8890/api/market/history/AAPL",
        "params": {"interval": "60", "range": "1week"},
        "desc": "1 Week数据 (interval=60, range=1week)"
    },
    {
        "url": "http://127.0.0.1:8890/api/market/history/AAPL",
        "params": {"interval": "D", "range": "1month"},
        "desc": "1 Month数据 (interval=D, range=1month)"
    }
]

for test in test_cases:
    print(f"\n测试: {test['desc']}")
    print(f"URL: {test['url']}")
    print(f"参数: {test['params']}")
    
    try:
        r = requests.get(test['url'], params=test['params'], timeout=5)
        print(f"状态码: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            print(f"✓ 成功! 数据条数: {data.get('count')}")
            print(f"  数据源: {data.get('dataSource')}")
            print(f"  间隔: {data.get('interval')}")
            print(f"  范围: {data.get('range')}")
        elif r.status_code == 404:
            print(f"✗ 404 - 路由不存在")
            print(f"  响应: {r.text[:200]}")
        else:
            print(f"✗ 其他错误: {r.status_code}")
            print(f"  响应: {r.text[:200]}")
            
    except Exception as e:
        print(f"✗ 请求失败: {e}")

print("\n" + "="*60)
print("检查后端路由定义...")
print("当前后端文件中的历史数据路由:")
print("  @app.route('/api/market/history/<symbol>', methods=['GET'])")
print("="*60)