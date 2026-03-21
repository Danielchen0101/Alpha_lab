import requests
import json
from datetime import datetime
import time

print("=== 完整数据追踪测试 ===")
print("模拟: 浏览器 -> 前端代理 -> 后端 -> 响应 -> 前端处理 -> 图表")

# 等待后端启动
print("\n等待后端启动...")
time.sleep(2)

# 测试1: 直接请求后端，查看后端实际发送的数据
print("\n1. === 后端实际发送的数据 ===")
try:
    direct_url = "http://127.0.0.1:8890/api/market/history/AAPL"
    direct_params = {'interval': 'D', 'range': '1year'}
    
    print(f"请求URL: {direct_url}")
    print(f"请求参数: {direct_params}")
    
    direct_r = requests.get(direct_url, params=direct_params, timeout=10)
    
    print(f"状态码: {direct_r.status_code}")
    
    if direct_r.status_code == 200:
        direct_data = direct_r.json()
        print(f"数据源: {direct_data.get('dataSource')}")
        print(f"数据条数: {direct_data.get('count')}")
        print(f"警告: {direct_data.get('warning', '无')}")
        print(f"是否模拟: {direct_data.get('isSimulated', '未知')}")
        
        points = direct_data.get('data', [])
        if points:
            closes = [p['close'] for p in points]
            print(f"价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
            print(f"最后收盘价: ${closes[-1]:.2f}")
            
            print(f"\n前5个close:")
            for i, close in enumerate(closes[:5]):
                print(f"  {i+1}. ${close:.2f}")
            
            print(f"\n后5个close:")
            for i, close in enumerate(closes[-5:]):
                print(f"  {len(closes)-4+i}. ${close:.2f}")
            
            # 保存后端返回的完整数据用于比较
            with open('backend_response.json', 'w', encoding='utf-8') as f:
                json.dump(direct_data, f, indent=2, ensure_ascii=False)
            print(f"\n后端完整响应已保存到: backend_response.json")
    else:
        print(f"错误: {direct_r.text[:200]}")
        
except Exception as e:
    print(f"直接请求失败: {e}")

# 测试2: 通过前端代理请求，查看前端实际接收的数据
print("\n2. === 前端代理实际接收的数据 ===")
try:
    proxy_url = "http://localhost:3000/api/market/history/AAPL"
    proxy_params = {'interval': 'D', 'range': '1year'}
    
    print(f"请求URL: {proxy_url}")
    print(f"请求参数: {proxy_params}")
    
    proxy_r = requests.get(proxy_url, params=proxy_params, timeout=10)
    
    print(f"状态码: {proxy_r.status_code}")
    
    if proxy_r.status_code == 200:
        proxy_data = proxy_r.json()
        print(f"数据源: {proxy_data.get('dataSource')}")
        print(f"数据条数: {proxy_data.get('count')}")
        print(f"警告: {proxy_data.get('warning', '无')}")
        print(f"是否模拟: {proxy_data.get('isSimulated', '未知')}")
        
        points = proxy_data.get('data', [])
        if points:
            closes = [p['close'] for p in points]
            print(f"价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
            print(f"最后收盘价: ${closes[-1]:.2f}")
            
            print(f"\n前5个close:")
            for i, close in enumerate(closes[:5]):
                print(f"  {i+1}. ${close:.2f}")
            
            print(f"\n后5个close:")
            for i, close in enumerate(closes[-5:]):
                print(f"  {len(closes)-4+i}. ${close:.2f}")
            
            # 保存前端接收的完整数据用于比较
            with open('frontend_response.json', 'w', encoding='utf-8') as f:
                json.dump(proxy_data, f, indent=2, ensure_ascii=False)
            print(f"\n前端完整响应已保存到: frontend_response.json")
    else:
        print(f"错误: {proxy_r.text[:200]}")
        
except Exception as e:
    print(f"代理请求失败: {e}")

# 测试3: 比较两个响应
print("\n3. === 数据不一致性分析 ===")
try:
    with open('backend_response.json', 'r', encoding='utf-8') as f:
        backend_data = json.load(f)
    
    with open('frontend_response.json', 'r', encoding='utf-8') as f:
        frontend_data = json.load(f)
    
    backend_closes = [p['close'] for p in backend_data.get('data', [])]
    frontend_closes = [p['close'] for p in frontend_data.get('data', [])]
    
    if backend_closes and frontend_closes:
        print(f"后端价格范围: ${min(backend_closes):.2f} - ${max(backend_closes):.2f}")
        print(f"前端价格范围: ${min(frontend_closes):.2f} - ${max(frontend_closes):.2f}")
        
        if abs(min(backend_closes) - min(frontend_closes)) > 1:
            print(f"❌ 价格不一致! 差异: ${abs(min(backend_closes) - min(frontend_closes)):.2f}")
        else:
            print(f"✓ 价格基本一致")
        
        # 检查数据结构差异
        print(f"\n数据结构差异:")
        print(f"  后端数据源: {backend_data.get('dataSource')}")
        print(f"  前端数据源: {frontend_data.get('dataSource')}")
        print(f"  后端数据条数: {len(backend_data.get('data', []))}")
        print(f"  前端数据条数: {len(frontend_data.get('data', []))}")
        
except Exception as e:
    print(f"比较失败: {e}")

print("\n=== 测试完成 ===")
print("请检查:")
print("1. 后端日志 (查看后端实际发送的数据)")
print("2. 浏览器控制台 (查看前端接收和处理的数据)")
print("3. 网络请求 (查看实际请求URL和响应)")