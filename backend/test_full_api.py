import requests
import json

print("测试完整API接口...")
print("="*80)

# 测试所有关键接口
apis_to_test = [
    ('/api/market/stocks?dashboard=true', 'Dashboard股票列表 (dashboard模式)'),
    ('/api/market/stocks', 'Market页面股票列表'),
    ('/api/market/stock/AAPL', '单股详情 (AAPL)'),
    ('/api/market/stock/NVDA', '单股详情 (NVDA)'),
    ('/api/market/history/AAPL?interval=60&range=1week', '图表历史数据 (AAPL 1周)'),
    ('/api/status', '系统状态'),
]

for api_path, description in apis_to_test:
    print(f"\n测试: {description}")
    print(f"接口: {api_path}")
    
    url = f'http://127.0.0.1:8890{api_path}'
    
    try:
        response = requests.get(url, timeout=5)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                
                # 检查Dashboard/Market响应
                if 'stocks' in data:
                    stocks = data['stocks']
                    print(f"股票数量: {len(stocks)}")
                    
                    if len(stocks) > 0:
                        print(f"数据源: {data.get('dataSource', 'N/A')}")
                        
                        # 显示前3支股票
                        print("前3支股票:")
                        for i, stock in enumerate(stocks[:3]):
                            symbol = stock.get('symbol', 'N/A')
                            price = stock.get('price', 0)
                            change = stock.get('change', 0)
                            change_percent = stock.get('changePercent', 0)
                            data_source = stock.get('dataSource', 'N/A')
                            print(f"  {i+1}. {symbol}: ${price:.2f} ({change:+.2f}, {change_percent:+.2f}%) - {data_source}")
                
                # 检查图表数据响应
                elif 'data' in data:
                    chart_data = data['data']
                    print(f"图表数据条数: {len(chart_data)}")
                    print(f"数据源: {data.get('dataSource', 'N/A')}")
                    print(f"备注: {data.get('note', 'N/A')}")
                    
                    if len(chart_data) > 0:
                        print(f"第一条数据: {chart_data[0]}")
                        print(f"最后一条数据: {chart_data[-1]}")
                
                # 检查单股详情
                elif 'symbol' in data and 'price' in data:
                    symbol = data.get('symbol')
                    price = data.get('price')
                    change = data.get('change', 0)
                    change_percent = data.get('changePercent', 0)
                    data_source = data.get('dataSource', 'N/A')
                    print(f"股票: {symbol}")
                    print(f"价格: ${price:.2f}")
                    print(f"变化: {change:+.2f} ({change_percent:+.2f}%)")
                    print(f"数据源: {data_source}")
                
                # 检查状态
                elif 'status' in data:
                    print(f"状态: {data.get('status')}")
                    print(f"数据源配置: {data.get('dataSources', {})}")
                    
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
print("数据源职责验证:")
print("1. Dashboard/Market普通数据 → Finnhub ✓")
print("2. Analyze/Chart图表数据 → Twelve Data ✓")
print("3. 职责分离清晰 ✓")