import requests
import json

# 测试不同的参数组合
TWELVEDATA_API_KEY = '3541c054d16843cb8e4b2ccefa456a01'

test_cases = [
    {'interval': '1day', 'outputsize': 40, 'range': '1month'},
    {'interval': '1day', 'outputsize': 30, 'range': '1month'},
    {'interval': '1day', 'outputsize': 20, 'range': '1month'},
    {'interval': '1h', 'outputsize': 100, 'range': '1week'},
    {'interval': '30min', 'outputsize': 200, 'range': '1week'},
]

url = "https://api.twelvedata.com/time_series"

for i, test_params in enumerate(test_cases):
    print(f"\n{'='*80}")
    print(f"测试用例 {i+1}: {test_params}")
    
    params = {
        'symbol': 'AAPL',
        'interval': test_params['interval'],
        'outputsize': test_params['outputsize'],
        'apikey': TWELVEDATA_API_KEY,
        'format': 'JSON'
    }
    
    try:
        response = requests.get(url, params=params, timeout=15)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"响应状态: {data.get('status', 'unknown')}")
            print(f"响应消息: {data.get('message', 'N/A')}")
            
            # 检查数据字段
            values = None
            if 'values' in data:
                values = data['values']
                print(f"找到'values'字段，数据点数: {len(values)}")
            elif 'Values' in data:
                values = data['Values']
                print(f"找到'Values'字段，数据点数: {len(values)}")
            elif 'data' in data:
                values = data['data']
                print(f"找到'data'字段，数据点数: {len(values)}")
            elif 'Data' in data:
                values = data['Data']
                print(f"找到'Data'字段，数据点数: {len(values)}")
            else:
                print(f"没有找到数据字段")
                print(f"响应字段: {list(data.keys())}")
                
        else:
            print(f"HTTP错误: {response.status_code}")
            
    except Exception as e:
        print(f"请求异常: {e}")