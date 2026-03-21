import requests
from datetime import datetime

print("测试前端修复后的数据流...")
print("1. 模拟前端请求（通过代理到8890）")
print("2. 检查数据一致性")

# 测试1: 直接请求8890后端
print("\n=== 测试1: 直接请求8890后端 ===")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1year'}, 
                    timeout=10)
    
    if r.status_code == 200:
        data = r.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"数据条数: {data.get('count')}")
        
        points = data.get('data', [])
        if points:
            closes = [p['close'] for p in points]
            print(f"价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
            print(f"最后收盘价: ${closes[-1]:.2f}")
            
            # 检查是否是模拟数据
            if "模拟数据" in data.get('dataSource', ''):
                print("⚠️ 使用模拟数据")
                print(f"  警告: {data.get('warning', '无')}")
            else:
                print("✓ 使用真实数据")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试2: 检查单股详情
print("\n=== 测试2: 检查单股详情 ===")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
    if r.status_code == 200:
        data = r.json()
        current_price = data.get('price')
        print(f"AAPL当前价格: ${current_price}")
        print(f"数据源: {data.get('dataSource')}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试3: 检查8889端口是否还有服务
print("\n=== 测试3: 检查8889端口 ===")
try:
    r = requests.get('http://127.0.0.1:8889/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1year'}, 
                    timeout=2)
    print(f"8889端口响应: {r.status_code}")
    if r.status_code == 200:
        print("⚠️ 警告: 8889端口仍有服务在运行!")
        print("前端可能请求到错误的后端!")
except:
    print("8889端口无响应 (正确)")

print("\n=== 总结 ===")
print("1. 前端修复: API_BASE_URL改为相对路径'/api'")
print("2. 代理配置: package.json指向8890")
print("3. 后端统一: 只运行8890端口")
print("4. 数据一致性: 需要启动前端验证")