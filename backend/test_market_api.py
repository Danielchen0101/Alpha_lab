import requests
import json

print("测试Market页面需要的API接口...")
print("="*80)

# 测试Market页面需要的所有接口
apis_to_test = [
    ('/api/market/stocks', 'GET', '市场股票列表'),
    ('/api/market/stock/AAPL', 'GET', '单股详情'),
    ('/api/market/history/AAPL?interval=60&range=1week', 'GET', '图表历史数据'),
    ('/api/status', 'GET', '系统状态'),
]

for api_path, method, description in apis_to_test:
    print(f"\n测试: {description}")
    print(f"接口: {api_path}")
    
    url = f'http://127.0.0.1:8890{api_path}'
    
    try:
        if method == 'GET':
            response = requests.get(url, timeout=5)
        else:
            response = requests.post(url, timeout=5)
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"响应结构: {list(data.keys())}")
                
                # 特别检查/market/stocks
                if api_path == '/api/market/stocks':
                    if 'stocks' in data:
                        stocks = data['stocks']
                        print(f"股票数量: {len(stocks)}")
                        if len(stocks) > 0:
                            print(f"示例股票: {stocks[0].get('symbol')} - ${stocks[0].get('price', 0):.2f}")
                        else:
                            print("警告: stocks数组为空")
                    else:
                        print("错误: 响应中没有stocks字段")
                
                # 检查数据源标识
                if 'dataSource' in data:
                    print(f"数据源: {data['dataSource']}")
                    
            except json.JSONDecodeError:
                print(f"响应不是JSON: {response.text[:100]}")
        elif response.status_code == 404:
            print("错误: 404 Not Found - 接口不存在")
        elif response.status_code == 500:
            print(f"错误: 500 Internal Server Error")
            print(f"错误详情: {response.text[:200]}")
        else:
            print(f"错误: HTTP {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到后端服务器")
    except Exception as e:
        print(f"错误: {e}")

print()
print("="*80)
print("分析:")
print("1. Market页面需要 /api/market/stocks 接口来获取股票列表")
print("2. 如果这个接口返回404，Market页面就会显示错误")
print("3. 我的简化版后端缺少这个接口")
print("4. 需要添加 /api/market/stocks 接口，使用Finnhub数据")