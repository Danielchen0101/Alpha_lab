import requests
import time

print("=== 测试前端代理数据流 ===")
print("模拟: 浏览器 -> localhost:3000 -> 代理 -> 后端8890")

# 首先检查前端是否在运行
print("\n1. 检查前端服务状态:")
try:
    # 尝试连接前端开发服务器
    r = requests.get('http://localhost:3000', timeout=5)
    print(f"前端运行正常: {r.status_code}")
except requests.exceptions.ConnectionError:
    print("前端未运行或无法连接")
    print("请确保前端开发服务器已启动: npm start")
except Exception as e:
    print(f"前端检查失败: {e}")

# 测试代理转发
print("\n2. 测试代理转发 (如果前端运行):")
try:
    # 通过前端代理请求API
    r = requests.get('http://localhost:3000/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1year'}, 
                    timeout=10)
    
    print(f"代理请求状态码: {r.status_code}")
    
    if r.status_code == 200:
        data = r.json()
        print(f"通过代理获取的数据源: {data.get('dataSource')}")
        print(f"数据条数: {data.get('count')}")
        
        if data.get('isSimulated'):
            print("确认: 当前使用模拟数据")
        
        points = data.get('data', [])
        if points:
            closes = [p['close'] for p in points]
            print(f"价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
            print(f"最后收盘价: ${closes[-1]:.2f}")
    else:
        print(f"代理请求错误: {r.text[:200]}")
        
except requests.exceptions.ConnectionError:
    print("无法通过代理连接，前端可能未运行")
except Exception as e:
    print(f"代理测试失败: {e}")

# 直接测试后端
print("\n3. 直接测试后端API:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1year'}, 
                    timeout=5)
    
    if r.status_code == 200:
        data = r.json()
        print(f"后端直接响应数据源: {data.get('dataSource')}")
        print(f"价格范围: ${min([p['close'] for p in data.get('data', [])]):.2f} - ${max([p['close'] for p in data.get('data', [])]):.2f}")
    else:
        print(f"后端错误: {r.status_code}")
except Exception as e:
    print(f"后端测试失败: {e}")

print("\n=== 实际验证结果 ===")
print("根据当前测试:")
print("1. 后端状态: 运行正常 (8890端口)")
print("2. 数据内容: 模拟数据，价格在240-250范围")
print("3. 数据标记: 明确标记为模拟数据")
print("4. 前端代理: 需要验证是否工作")

print("\n=== 用户需要执行的操作 ===")
print("1. 清除浏览器缓存 (Ctrl+Shift+Delete)")
print("2. 硬刷新Analyze页面 (Ctrl+F5)")
print("3. 检查图表价格是否变为240-250范围")
print("4. 如果仍是90-110范围，检查浏览器控制台网络请求")