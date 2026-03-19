import requests
import json
import time

print("真实测试API接口")
print("=" * 60)
time.sleep(2)

# 测试1: /api/market/stock/AAPL
print("\n测试 1: GET /api/market/stock/AAPL")
print("-" * 40)

try:
    response = requests.get('http://127.0.0.1:8889/api/market/stock/AAPL', timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("成功! 响应JSON:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        # 验证关键字段
        required_fields = ['symbol', 'name', 'price', 'marketCap', 'sector', 'peRatio']
        missing = []
        for field in required_fields:
            if field not in data or data[field] is None:
                missing.append(field)
        
        if missing:
            print(f"警告: 缺失字段: {missing}")
        else:
            print("所有关键字段都存在")
            
    elif response.status_code == 404:
        print("错误: 404 Not Found - 路由未注册")
        print(f"响应: {response.text[:200]}")
    else:
        print(f"错误: HTTP {response.status_code}")
        print(f"响应: {response.text[:200]}")
        
except Exception as e:
    print(f"异常: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

# 测试2: /api/market/history/AAPL
print("\n" + "=" * 60)
print("\n测试 2: GET /api/market/history/AAPL?interval=1day&range=1month")
print("-" * 40)

try:
    response = requests.get('http://127.0.0.1:8889/api/market/history/AAPL?interval=1day&range=1month', timeout=15)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("成功! 响应JSON:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        
        print(f"\n数据统计:")
        print(f"  count: {data.get('count')}")
        print(f"  source: {data.get('source')}")
        print(f"  message: {data.get('message')}")
        
        if data.get('data'):
            print(f"  有 {len(data['data'])} 个数据点")
            print(f"  第一个数据点: timestamp={data['data'][0].get('timestamp')}, close={data['data'][0].get('close')}")
        else:
            print("  数据为空")
            
    elif response.status_code == 404:
        print("错误: 404 Not Found - 路由未注册")
        print(f"响应: {response.text[:200]}")
    else:
        print(f"错误: HTTP {response.status_code}")
        print(f"响应: {response.text[:200]}")
        
except Exception as e:
    print(f"异常: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()

# 测试3: 检查路由列表
print("\n" + "=" * 60)
print("\n测试 3: 检查所有路由")
print("-" * 40)

try:
    response = requests.get('http://127.0.0.1:8889/api/health', timeout=5)
    if response.status_code == 200:
        print("健康检查通过")
        
    # 尝试获取一些路由信息
    print("\n测试其他路由:")
    test_routes = [
        '/api/market/stocks',
        '/api/health',
        '/api/system/status'
    ]
    
    for route in test_routes:
        try:
            r = requests.get(f'http://127.0.0.1:8889{route}', timeout=5)
            print(f"  {route}: HTTP {r.status_code}")
        except:
            print(f"  {route}: 请求失败")
            
except Exception as e:
    print(f"异常: {e}")

print("\n" + "=" * 60)
print("测试完成")