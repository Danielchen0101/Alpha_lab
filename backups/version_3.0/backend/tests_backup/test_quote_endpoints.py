"""
测试后端quote接口
"""

import requests

def test_quote_endpoints():
    """测试后端quote接口"""
    print("="*80)
    print("测试后端quote接口")
    print("="*80)
    
    base_url = "http://localhost:8889"
    symbol = "AAPL"
    
    endpoints = [
        f"/api/stock/quote?symbol={symbol}",  # 前端正在调用的（不存在）
        f"/api/market/stock/{symbol}",        # 后端实际存在的
        f"/api/market/stocks?dashboard=true", # 批量接口
    ]
    
    for endpoint in endpoints:
        print(f"\n测试接口: {endpoint}")
        try:
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
            print(f"  状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"  响应类型: {type(data)}")
                
                # 检查是否有收盘价字段
                if isinstance(data, dict):
                    # 查找可能的收盘价字段
                    price_fields = ['c', 'pc', 'close', 'currentPrice', 'price']
                    found_fields = []
                    for field in price_fields:
                        if field in data:
                            found_fields.append(f"{field}: {data[field]}")
                    
                    if found_fields:
                        print(f"  找到价格字段: {', '.join(found_fields)}")
                    else:
                        print(f"  未找到标准价格字段，数据: {data}")
                elif isinstance(data, list):
                    print(f"  返回列表，长度: {len(data)}")
                    if len(data) > 0:
                        first_item = data[0]
                        print(f"  第一项: {first_item}")
            else:
                print(f"  响应文本: {response.text[:200]}")
                
        except Exception as e:
            print(f"  请求失败: {e}")

def check_backend_routes():
    """检查后端路由定义"""
    print("\n" + "="*80)
    print("检查后端路由定义")
    print("="*80)
    
    try:
        with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 查找所有路由定义
        import re
        routes = re.findall(r'@app\.route\(["\']([^"\']+)["\']', content)
        
        print("后端定义的路由:")
        for route in sorted(set(routes)):
            if 'stock' in route or 'quote' in route:
                print(f"  {route}")
        
        # 特别检查quote相关路由
        print("\n与quote相关的路由:")
        for route in sorted(set(routes)):
            if 'quote' in route.lower():
                print(f"  {route}")
        
        if not any('quote' in route.lower() for route in routes):
            print("  ⚠️ 没有找到/quote相关路由")
            
    except Exception as e:
        print(f"检查路由失败: {e}")

if __name__ == '__main__':
    test_quote_endpoints()
    check_backend_routes()