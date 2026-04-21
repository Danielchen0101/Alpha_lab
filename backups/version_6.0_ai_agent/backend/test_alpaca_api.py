import requests
import json
import time

# Alpaca 配置
api_key = 'PKFQZZXERLVJLJHODHPPEB52RD'
api_secret = '5odo2jBF7YFLa7DAvss3hV7WVXE789ktTor7zMyPewxa'

headers = {
    'APCA-API-KEY-ID': api_key,
    'APCA-API-SECRET-KEY': api_secret
}

symbols = ['AAPL', 'NVDA', 'TSLA']

def test_market_data_api(symbol):
    """测试市场数据API"""
    print(f"\n=== 测试 {symbol} 市场数据API ===")
    
    # 1. 测试最新报价
    quote_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/quotes/latest'
    try:
        response = requests.get(quote_url, headers=headers, timeout=5)
        print(f"报价API状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"报价API响应: {json.dumps(data, indent=2)}")
            print(f"报价字段: {list(data.get('quote', {}).keys())}")
        else:
            print(f"报价API错误: {response.text}")
    except Exception as e:
        print(f"报价API异常: {e}")
    
    # 2. 测试最新交易
    trade_url = f'https://paper-api.alpaca.markets/v2/stocks/{symbol}/trades/latest'
    try:
        response = requests.get(trade_url, headers=headers, timeout=5)
        print(f"交易API状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"交易API响应: {json.dumps(data, indent=2)}")
            print(f"交易字段: {list(data.get('trade', {}).keys())}")
        else:
            print(f"交易API错误: {response.text}")
    except Exception as e:
        print(f"交易API异常: {e}")
    
    # 3. 测试最新bar（可能包含OHLC数据）
    bars_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/bars/latest'
    params = {'timeframe': '1D'}
    try:
        response = requests.get(bars_url, headers=headers, params=params, timeout=5)
        print(f"Bar API状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Bar API响应: {json.dumps(data, indent=2)}")
            if 'bar' in data:
                print(f"Bar字段: {list(data['bar'].keys())}")
        else:
            print(f"Bar API错误: {response.text}")
    except Exception as e:
        print(f"Bar API异常: {e}")

if __name__ == '__main__':
    print("开始测试Alpaca API响应结构...")
    for symbol in symbols:
        test_market_data_api(symbol)
        time.sleep(1)  # 避免请求过快