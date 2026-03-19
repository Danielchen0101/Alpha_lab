import requests
import json
import time

print("测试API健康状态")
print("=" * 60)

# 测试健康检查
print("1. 测试健康检查端点:")
try:
    response = requests.get('http://localhost:8889/api/health', timeout=5)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"响应: {json.dumps(data, indent=2)}")
    else:
        print(f"响应: {response.text[:200]}")
except Exception as e:
    print(f"错误: {e}")

print("\n2. 测试市场数据端点:")
try:
    response = requests.get('http://localhost:8889/api/market/stocks', timeout=10)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"股票数量: {data.get('count', 0)}")
        if data.get('stocks'):
            print(f"前3只股票:")
            for stock in data['stocks'][:3]:
                print(f"  {stock.get('symbol')}: ${stock.get('price')}")
    else:
        print(f"响应: {response.text[:200]}")
except Exception as e:
    print(f"错误: {e}")

print("\n3. 测试单个股票端点:")
try:
    response = requests.get('http://localhost:8889/api/market/stock/AAPL', timeout=10)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"股票数据:")
        print(f"  名称: {data.get('name')}")
        print(f"  价格: ${data.get('price')}")
        print(f"  市值: {data.get('marketCap')}")
        print(f"  成交量: {data.get('volume')}")
    else:
        print(f"响应: {response.text[:200]}")
except Exception as e:
    print(f"错误: {e}")

print("\n4. 测试前端代理访问:")
try:
    # 通过前端代理访问
    response = requests.get('http://localhost:3000/api/market/stock/AAPL', timeout=10)
    print(f"前端代理状态码: {response.status_code}")
    if response.status_code == 200:
        print("✅ 前端可以访问后端API")
    else:
        print(f"前端代理响应: {response.text[:200]}")
except Exception as e:
    print(f"前端代理错误: {e}")

print("\n5. 检查可能的错误:")
print("a) 检查后端日志:")
print("   - 查看 quant_backend.py 控制台输出")
print("   - 检查 logs/backend.log 文件")
print("\nb) 检查前端控制台:")
print("   - 浏览器开发者工具 -> Network 标签")
print("   - 查看 API 请求是否失败")
print("\nc) 常见问题:")
print("   - CORS 配置问题")
print("   - API 路由未注册")
print("   - 数据库连接问题")
print("   - Finnhub API key 限制")