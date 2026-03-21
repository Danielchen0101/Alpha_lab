import requests
import json

print("测试Dashboard接口...")
print("="*80)

# 测试Dashboard需要的接口
apis_to_test = [
    ('/api/market/stocks?dashboard=true', 'GET', 'Dashboard股票列表 (dashboard模式)'),
    ('/api/market/stocks', 'GET', '普通股票列表'),
    ('/api/market/stock/AAPL', 'GET', '单股详情'),
    ('/api/status', 'GET', '系统状态'),
]

for api_path, method, description in apis_to_test:
    print(f"\n测试: {description}")
    print(f"接口: {api_path}")
    
    url = f'http://127.0.0.1:8890{api_path}'
    
    try:
        response = requests.get(url, timeout=5)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"响应结构: {list(data.keys())}")
                
                # 检查Dashboard响应
                if 'dashboard=true' in api_path:
                    if 'stocks' in data:
                        stocks = data['stocks']
                        print(f"Dashboard股票数量: {len(stocks)}")
                        if len(stocks) > 0:
                            # 检查字段
                            first_stock = stocks[0]
                            required_fields = ['symbol', 'name', 'price', 'change', 'changePercent']
                            missing_fields = [f for f in required_fields if f not in first_stock]
                            
                            if missing_fields:
                                print(f"错误: 缺少字段: {missing_fields}")
                            else:
                                print(f"示例股票: {first_stock['symbol']} - ${first_stock['price']:.2f} ({first_stock['changePercent']:.2f}%)")
                        else:
                            print("警告: stocks数组为空")
                    else:
                        print("错误: 响应中没有stocks字段")
                
                # 检查数据源
                if 'dataSource' in data:
                    print(f"数据源: {data['dataSource']}")
                    
            except json.JSONDecodeError as e:
                print(f"JSON解析错误: {e}")
                print(f"响应内容: {response.text[:200]}")
        elif response.status_code == 500:
            print("错误: 500 Internal Server Error")
            print(f"错误详情: {response.text[:500]}")
        else:
            print(f"错误: HTTP {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到后端服务器")
    except Exception as e:
        print(f"错误: {e}")

print()
print("="*80)
print("直接测试后端日志...")
print("现在查看后端控制台输出，应该能看到异常信息")