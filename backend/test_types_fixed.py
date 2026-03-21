import requests
import json

print("=== 验证类型修复 ===")

# 测试1: 检查后端响应结构
print("\n1. 检查后端响应结构:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1year'}, 
                    timeout=5)
    
    if r.status_code == 200:
        data = r.json()
        print(f"后端响应包含的字段:")
        for key in data.keys():
            print(f"  - {key}: {type(data[key]).__name__}")
        
        # 检查我们添加的字段
        required_fields = ['warning', 'isSimulated', 'basePrice', 'priceRange']
        for field in required_fields:
            if field in data:
                print(f"  ✓ {field}: {data[field]}")
            else:
                print(f"  ✗ {field}: 缺失")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试2: 检查前端代理响应
print("\n2. 检查前端代理响应:")
try:
    r = requests.get('http://localhost:3000/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1year'}, 
                    timeout=5)
    
    if r.status_code == 200:
        data = r.json()
        print(f"前端代理响应包含的字段:")
        for key in data.keys():
            print(f"  - {key}: {type(data[key]).__name__}")
        
        # 检查数据差异
        if 'data' in data and data['data']:
            closes = [p['close'] for p in data['data']]
            print(f"  价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n=== 类型修复验证 ===")
print("如果后端响应包含 warning, isSimulated, basePrice, priceRange 字段:")
print("✓ 类型修复成功")
print("如果前端代理返回 $90-109 范围:")
print("⚠️ 前端代理问题仍然存在")