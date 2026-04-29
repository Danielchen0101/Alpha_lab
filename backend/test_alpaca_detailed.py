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

def test_all_endpoints(symbol):
    """测试所有Alpaca端点"""
    print(f"\n{'='*60}")
    print(f"测试 {symbol} - 所有Alpaca端点")
    print(f"{'='*60}")
    
    # 1. 测试最新交易 (market data host)
    print(f"\n1. 测试最新交易 (market data host)")
    trade_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/trades/latest'
    try:
        response = requests.get(trade_url, headers=headers, timeout=5)
        print(f"   URL: {trade_url}")
        print(f"   状态码: {response.status_code}")
        print(f"   响应头: {dict(response.headers)}")
        if response.status_code == 200:
            data = response.json()
            print(f"   响应体: {json.dumps(data, indent=4)}")
            if 'trade' in data:
                trade = data['trade']
                print(f"   trade字段: {list(trade.keys())}")
                print(f"   trade.p (价格): {trade.get('p')}")
                print(f"   trade.s (成交量): {trade.get('s')}")
                print(f"   trade.t (时间戳): {trade.get('t')}")
                print(f"   trade.x (交易所): {trade.get('x')}")
        else:
            print(f"   错误响应: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")
    
    # 2. 测试最新报价
    print(f"\n2. 测试最新报价")
    quote_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/quotes/latest'
    try:
        response = requests.get(quote_url, headers=headers, timeout=5)
        print(f"   URL: {quote_url}")
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   响应体: {json.dumps(data, indent=4)}")
            if 'quote' in data:
                quote = data['quote']
                print(f"   quote字段: {list(quote.keys())}")
                print(f"   quote.bp (买价): {quote.get('bp')}")
                print(f"   quote.ap (卖价): {quote.get('ap')}")
                print(f"   quote.bx (买交易所): {quote.get('bx')}")
                print(f"   quote.ax (卖交易所): {quote.get('ax')}")
        else:
            print(f"   错误响应: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")
    
    # 3. 测试最新bars (1分钟)
    print(f"\n3. 测试最新bars (1分钟)")
    bars_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/bars/latest'
    params = {'timeframe': '1Min'}
    try:
        response = requests.get(bars_url, headers=headers, params=params, timeout=5)
        print(f"   URL: {bars_url}")
        print(f"   参数: timeframe=1Min")
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   响应体: {json.dumps(data, indent=4)}")
            if 'bar' in data:
                bar = data['bar']
                print(f"   bar字段: {list(bar.keys())}")
                print(f"   bar.o (开盘价): {bar.get('o')}")
                print(f"   bar.h (最高价): {bar.get('h')}")
                print(f"   bar.l (最低价): {bar.get('l')}")
                print(f"   bar.c (收盘价): {bar.get('c')}")
                print(f"   bar.v (成交量): {bar.get('v')}")
        else:
            print(f"   错误响应: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")
    
    # 4. 测试最新bars (1天)
    print(f"\n4. 测试最新bars (1天)")
    bars_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/bars/latest'
    params = {'timeframe': '1D'}
    try:
        response = requests.get(bars_url, headers=headers, params=params, timeout=5)
        print(f"   URL: {bars_url}")
        print(f"   参数: timeframe=1D")
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   响应体: {json.dumps(data, indent=4)}")
            if 'bar' in data:
                bar = data['bar']
                print(f"   bar字段: {list(bar.keys())}")
                print(f"   bar.o (开盘价): {bar.get('o')}")
                print(f"   bar.h (最高价): {bar.get('h')}")
                print(f"   bar.l (最低价): {bar.get('l')}")
                print(f"   bar.c (收盘价): {bar.get('c')}")
                print(f"   bar.v (成交量): {bar.get('v')}")
        else:
            print(f"   错误响应: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")
    
    # 5. 测试交易API的最新交易 (作为备选)
    print(f"\n5. 测试交易API的最新交易 (备选)")
    trade_url_paper = f'https://paper-api.alpaca.markets/v2/stocks/{symbol}/trades/latest'
    try:
        response = requests.get(trade_url_paper, headers=headers, timeout=5)
        print(f"   URL: {trade_url_paper}")
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   响应体: {json.dumps(data, indent=4)}")
            if 'trade' in data:
                trade = data['trade']
                print(f"   trade字段: {list(trade.keys())}")
        else:
            print(f"   错误响应: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")

if __name__ == '__main__':
    print("开始详细测试Alpaca所有端点...")
    for symbol in symbols:
        test_all_endpoints(symbol)
        time.sleep(2)  # 避免请求过快