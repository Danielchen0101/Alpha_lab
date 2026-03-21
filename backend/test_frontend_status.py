import requests
import time

print("测试前端状态...")

# 测试前端是否响应
try:
    print("尝试连接前端...")
    r = requests.get('http://localhost:3000', timeout=5)
    print(f"前端响应状态码: {r.status_code}")
    print("前端运行正常")
except requests.exceptions.ConnectionError:
    print("前端未运行或无法连接")
    print("请运行: cd professional_quant_platform/frontend && npm start")
except Exception as e:
    print(f"前端测试失败: {e}")

# 测试API端点
print("\n测试API端点...")
try:
    r = requests.get('http://localhost:3000/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1year'}, 
                    timeout=5)
    print(f"API响应状态码: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"数据条数: {data.get('count')}")
except Exception as e:
    print(f"API测试失败: {e}")

print("\n=== 状态总结 ===")
print("如果前端未运行，请执行:")
print("1. cd professional_quant_platform/frontend")
print("2. npm start")
print("3. 等待编译完成")
print("4. 访问 http://localhost:3000")