import requests
import json

# Alpaca 配置
api_key = 'PKFQZZXERLVJLJHODHPPEB52RD'
api_secret = '5odo2jBF7YFLa7DAvss3hV7WVXE789ktTor7zMyPewxa'

headers = {
    'APCA-API-KEY-ID': api_key,
    'APCA-API-SECRET-KEY': api_secret
}

symbols = ['AAPL', 'NVDA']

def test_bars_endpoints(symbol):
    """测试bars API的不同参数"""
    print(f"\n{'='*60}")
    print(f"测试 {symbol} - bars API")
    print(f"{'='*60}")
    
    # 1. 测试最新bar（不传参数）
    print(f"\n1. 测试最新bar（不传参数）")
    bars_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/bars/latest'
    try:
        response = requests.get(bars_url, headers=headers, timeout=5)
        print(f"   URL: {bars_url}")
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   响应体: {json.dumps(data, indent=4)}")
        else:
            print(f"   错误响应: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")
    
    # 2. 测试bars列表（获取多根bar）
    print(f"\n2. 测试bars列表（获取多根bar）")
    bars_list_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/bars'
    params = {
        'timeframe': '1Day',
        'limit': 2  # 获取2根bar，最新的一根和前一日的
    }
    try:
        response = requests.get(bars_list_url, headers=headers, params=params, timeout=5)
        print(f"   URL: {bars_list_url}")
        print(f"   参数: {params}")
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   响应体: {json.dumps(data, indent=4)}")
            if 'bars' in data:
                bars = data['bars']
                print(f"   获取到 {len(bars)} 根bar")
                for i, bar in enumerate(bars):
                    print(f"   Bar {i}: t={bar.get('t')}, o={bar.get('o')}, h={bar.get('h')}, l={bar.get('l')}, c={bar.get('c')}, v={bar.get('v')}")
        else:
            print(f"   错误响应: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")
    
    # 3. 测试1分钟bars
    print(f"\n3. 测试1分钟bars")
    params = {
        'timeframe': '1Min',
        'limit': 2
    }
    try:
        response = requests.get(bars_list_url, headers=headers, params=params, timeout=5)
        print(f"   URL: {bars_list_url}")
        print(f"   参数: {params}")
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   响应体: {json.dumps(data, indent=4)}")
        else:
            print(f"   错误响应: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")

if __name__ == '__main__':
    print("开始测试Alpaca bars API...")
    for symbol in symbols:
        test_bars_endpoints(symbol)