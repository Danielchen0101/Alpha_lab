import requests
import json
import time

def test_history_api():
    print('=== 测试历史数据接口 ===')
    
    # 测试不同的时间范围
    test_cases = [
        {'interval': '60', 'range': '1day', 'desc': '1天数据 (60分钟间隔)'},
        {'interval': '60', 'range': '1week', 'desc': '1周数据 (60分钟间隔)'},
        {'interval': 'D', 'range': '1month', 'desc': '1月数据 (日间隔)'},
        {'interval': 'D', 'range': '3month', 'desc': '3月数据 (日间隔)'},
        {'interval': 'D', 'range': '1year', 'desc': '1年数据 (日间隔)'}
    ]
    
    for test_case in test_cases:
        print(f'\n--- {test_case["desc"]} ---')
        params = {
            'interval': test_case['interval'],
            'range': test_case['range']
        }
        
        try:
            response = requests.get('http://127.0.0.1:8889/api/market/history/AAPL', 
                                   params=params, timeout=10)
            print(f'状态码: {response.status_code}')
            
            if response.status_code == 200:
                data = response.json()
                print(f'成功! 数据条数: {data.get("count")}')
                print(f'数据源: {data.get("dataSource")}')
                print(f'间隔: {data.get("interval")}')
                print(f'范围: {data.get("range")}')
                
                # 显示前3条数据
                data_points = data.get('data', [])
                if data_points:
                    print('前3条数据:')
                    for i, point in enumerate(data_points[:3]):
                        print(f'  {i+1}. 时间: {point.get("time")}, 收盘价: {point.get("close")}')
            else:
                print(f'错误: {response.text[:200]}')
                
        except Exception as e:
            print(f'请求失败: {e}')

def test_single_stock():
    print('\n=== 测试单股详情接口 ===')
    try:
        response = requests.get('http://127.0.0.1:8889/api/market/stock/AAPL', timeout=10)
        print(f'状态码: {response.status_code}')
        
        if response.status_code == 200:
            data = response.json()
            print(f'成功! 股票: {data.get("symbol")}')
            print(f'名称: {data.get("name")}')
            print(f'价格: {data.get("price")}')
            print(f'涨跌: {data.get("change")}')
            print(f'涨跌幅: {data.get("changePercent")}%')
        else:
            print(f'错误: {response.text}')
            
    except Exception as e:
        print(f'请求失败: {e}')

if __name__ == "__main__":
    # 等待后端启动
    print('等待后端启动...')
    time.sleep(2)
    
    test_history_api()
    test_single_stock()