import requests
import json

# 测试所有Dashboard可能调用的接口
base_url = "http://127.0.0.1:8890"

apis_to_test = [
    # 主要接口
    ("/api/market/stocks", {"dashboard": "true"}),
    ("/api/market/stocks", {}),  # 不带参数
    ("/api/market/stocks", {"symbols": "AAPL,MSFT"}),
    
    # 其他可能接口
    ("/api/market/overview", {}),
    ("/api/market/summary", {}),
    ("/api/market/status", {}),
    ("/api/market/sectors", {}),
    ("/api/market/breadth", {}),
]

print("测试Dashboard相关接口...")
print(f"基础URL: {base_url}")

for endpoint, params in apis_to_test:
    url = f"{base_url}{endpoint}"
    print(f"\n=== 测试 {endpoint} ===")
    print(f"参数: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"响应结构: {list(data.keys()) if isinstance(data, dict) else type(data)}")
                print(f"数据长度: {len(data) if isinstance(data, (list, dict)) else 'N/A'}")
                
                # 如果是stocks接口，检查数据
                if endpoint == "/api/market/stocks" and isinstance(data, dict) and 'stocks' in data:
                    stocks = data['stocks']
                    print(f"股票数量: {len(stocks)}")
                    if stocks:
                        print(f"示例股票: {stocks[0].get('symbol', 'N/A')} - {stocks[0].get('name', 'N/A')}")
            except json.JSONDecodeError:
                print(f"响应不是JSON: {response.text[:200]}")
        elif response.status_code == 500:
            print(f"❌ 500错误！响应: {response.text[:500]}")
        else:
            print(f"响应: {response.text[:200]}")
            
    except requests.exceptions.ConnectionError:
        print(f"❌ 连接失败")
    except Exception as e:
        print(f"❌ 测试失败: {e}")