import requests
import json

print("=== 数据不一致性测试 ===")
print("比较: 直接请求后端 vs 通过前端代理")

endpoints = [
    "/api/market/history/AAPL?interval=D&range=1year",
    "/api/market/stock/AAPL",
    "/api/market/stocks"
]

for endpoint in endpoints:
    print(f"\n测试端点: {endpoint}")
    
    # 直接请求后端
    try:
        direct_url = f"http://127.0.0.1:8890{endpoint.split('?')[0]}"
        direct_params = {}
        if '?' in endpoint:
            params_str = endpoint.split('?')[1]
            for param in params_str.split('&'):
                key, value = param.split('=')
                direct_params[key] = value
        
        direct_r = requests.get(direct_url, params=direct_params, timeout=5)
        
        if direct_r.status_code == 200:
            direct_data = direct_r.json()
            if 'data' in direct_data and direct_data['data']:
                closes = [p.get('close', 0) for p in direct_data.get('data', []) if 'close' in p]
                if closes:
                    print(f"  直接后端: 价格范围 ${min(closes):.2f}-${max(closes):.2f}, 数据源: {direct_data.get('dataSource', 'N/A')}")
                else:
                    print(f"  直接后端: 数据源: {direct_data.get('dataSource', 'N/A')}")
            else:
                print(f"  直接后端: 数据源: {direct_data.get('dataSource', 'N/A')}")
        else:
            print(f"  直接后端: 错误 {direct_r.status_code}")
    except Exception as e:
        print(f"  直接后端请求失败: {e}")
    
    # 通过前端代理
    try:
        proxy_url = f"http://localhost:3000{endpoint}"
        proxy_r = requests.get(proxy_url, timeout=5)
        
        if proxy_r.status_code == 200:
            proxy_data = proxy_r.json()
            if 'data' in proxy_data and proxy_data['data']:
                closes = [p.get('close', 0) for p in proxy_data.get('data', []) if 'close' in p]
                if closes:
                    print(f"  前端代理: 价格范围 ${min(closes):.2f}-${max(closes):.2f}, 数据源: {proxy_data.get('dataSource', 'N/A')}")
                else:
                    print(f"  前端代理: 数据源: {proxy_data.get('dataSource', 'N/A')}")
            else:
                print(f"  前端代理: 数据源: {proxy_data.get('dataSource', 'N/A')}")
        else:
            print(f"  前端代理: 错误 {proxy_r.status_code}")
    except Exception as e:
        print(f"  前端代理请求失败: {e}")

print("\n=== 分析 ===")
print("如果直接后端和前端代理返回的数据不同，可能原因:")
print("1. 前端有缓存 (需要清除缓存)")
print("2. 前端有本地mock数据")
print("3. 前端请求了不同的后端")
print("4. 代理配置错误")

print("\n=== 解决方案 ===")
print("1. 清除浏览器缓存: Ctrl+Shift+Delete")
print("2. 硬刷新页面: Ctrl+F5")
print("3. 检查浏览器控制台网络请求")
print("4. 查看实际请求的URL和响应")