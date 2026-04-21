#!/usr/bin/env python3
"""
检查Flask应用配置
"""
import start_quant_backend

app = start_quant_backend.app

print("检查Flask应用配置")
print("=" * 60)

print(f"应用名称: {app.name}")
print(f"根路径: {app.root_path}")
print(f"静态文件夹: {app.static_folder}")
print(f"模板文件夹: {app.template_folder}")

print("\n检查URL映射:")
print(f"URL映射长度: {len(app.url_map._rules)}")

# 创建一个测试客户端
with app.test_client() as client:
    print("\n使用测试客户端测试路由:")
    
    # 测试 /api/ai/trade/status
    response = client.get('/api/ai/trade/status')
    print(f"GET /api/ai/trade/status: {response.status_code}")
    if response.status_code == 200:
        print(f"  响应: {response.get_json()}")
    
    # 测试 /api/status
    response = client.get('/api/status')
    print(f"GET /api/status: {response.status_code}")
    if response.status_code == 200:
        print(f"  响应: {response.get_json()}")

print("\n检查完成")