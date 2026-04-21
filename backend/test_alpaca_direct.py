#!/usr/bin/env python3
"""
直接测试Alpaca API，检查volume数据
"""

import requests
import json
import time

# Alpaca API配置
api_key = "PKFQZZXERLVJLJHODHPPEB52RD"
api_secret = "5odo2jBF7YFLa7DAvss3hV7WVXE789ktTor7zMyP"

headers = {
    'APCA-API-KEY-ID': api_key,
    'APCA-API-SECRET-KEY': api_secret
}

def test_alpaca_for_symbol(symbol):
    """测试单个symbol的Alpaca API"""
    print(f"\n{'='*80}")
    print(f"测试 {symbol} 的Alpaca API")
    print('='*80)
    
    # 1. 测试latest trade
    print("\n1. Latest Trade API:")
    trade_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/trades/latest'
    try:
        response = requests.get(trade_url, headers=headers, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            trade = data.get('trade', {})
            print(f"   价格: {trade.get('p')}")
            print(f"   数量: {trade.get('s')}")
            print(f"   交易所: {trade.get('x')}")
        else:
            print(f"   响应: {response.text[:200]}")
    except Exception as e:
        print(f"   异常: {e}")
    
    # 2. 测试latest quote
    print("\n2. Latest Quote API:")
    quote_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/quotes/latest'
    try:
        response = requests.get(quote_url, headers=headers, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            quote = data.get('quote', {})
            print(f"   Bid: {quote.get('bp')} (数量: {quote.get('bs')})")
            print(f"   Ask: {quote.get('ap')} (数量: {quote.get('as')})")
        else:
            print(f"   响应: {response.text[:200]}")
    except Exception as e:
        print(f"   异常: {e}")
    
    # 3. 测试latest bar (这是关键，用于获取volume)
    print("\n3. Latest Bar API (用于volume):")
    bar_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/bars/latest'
    try:
        response = requests.get(bar_url, headers=headers, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            bar = data.get('bar', {})
            print(f"   开盘价: {bar.get('o')}")
            print(f"   最高价: {bar.get('h')}")
            print(f"   最低价: {bar.get('l')}")
            print(f"   收盘价: {bar.get('c')}")
            print(f"   成交量(volume): {bar.get('v')} (类型: {type(bar.get('v'))})")
            print(f"   交易笔数: {bar.get('n')}")
            print(f"   VWAP: {bar.get('vw')}")
        else:
            print(f"   响应: {response.text[:200]}")
    except Exception as e:
        print(f"   异常: {e}")
    
    # 4. 测试daily bars (用于previous close)
    print("\n4. Daily Bars API (用于previous close):")
    daily_url = f'https://data.alpaca.markets/v2/stocks/{symbol}/bars'
    params = {
        'timeframe': '1Day',
        'limit': 2
    }
    try:
        response = requests.get(daily_url, headers=headers, params=params, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            bars = data.get('bars', [])
            print(f"   获取到 {len(bars)} 根日线bar")
            for i, bar in enumerate(bars):
                print(f"   Bar {i}: O={bar.get('o')}, H={bar.get('h')}, L={bar.get('l')}, C={bar.get('c')}, V={bar.get('v')}")
        else:
            print(f"   响应: {response.text[:200]}")
    except Exception as e:
        print(f"   异常: {e}")
    
    # 5. 测试snapshot (批量数据)
    print("\n5. Snapshot API:")
    snapshot_url = f'https://data.alpaca.markets/v2/stocks/snapshots?symbols={symbol}'
    try:
        response = requests.get(snapshot_url, headers=headers, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            snapshot = data.get(symbol, {})
            print(f"   Snapshot keys: {list(snapshot.keys())}")
            if 'latestTrade' in snapshot:
                print(f"   最新交易: {snapshot['latestTrade'].get('p')}")
            if 'latestQuote' in snapshot:
                print(f"   最新报价: {snapshot['latestQuote'].get('bp')} / {snapshot['latestQuote'].get('ap')}")
            if 'minuteBar' in snapshot:
                print(f"   分钟bar: V={snapshot['minuteBar'].get('v')}")
            if 'dailyBar' in snapshot:
                print(f"   日线bar: V={snapshot['dailyBar'].get('v')}")
            if 'prevDailyBar' in snapshot:
                print(f"   前一日bar: V={snapshot['prevDailyBar'].get('v')}")
        else:
            print(f"   响应: {response.text[:200]}")
    except Exception as e:
        print(f"   异常: {e}")
    
    return True

def test_finnhub_volume(symbol):
    """测试Finnhub API获取volume"""
    print(f"\n{'='*80}")
    print(f"测试 {symbol} 的Finnhub API (用于volume回退)")
    print('='*80)
    
    # 使用后端中相同的Finnhub API密钥
    finnhub_api_key = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"
    
    quote_url = f'https://finnhub.io/api/v1/quote?symbol={symbol}&token={finnhub_api_key}'
    
    try:
        response = requests.get(quote_url, timeout=10)
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"当前价格(c): {data.get('c')}")
            print(f"涨跌幅(dp): {data.get('dp')}")
            print(f"成交量(v): {data.get('v')} (类型: {type(data.get('v'))})")
            print(f"最高价(h): {data.get('h')}")
            print(f"最低价(l): {data.get('l')}")
            print(f"开盘价(o): {data.get('o')}")
            print(f"前一收盘价(pc): {data.get('pc')}")
        else:
            print(f"响应: {response.text[:200]}")
    except Exception as e:
        print(f"异常: {e}")
    
    return True

if __name__ == '__main__':
    print("Alpaca API直接测试")
    print("="*80)
    
    # 测试关键股票
    test_symbols = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'AVGO', 'JPM', 'XOM']
    
    for symbol in test_symbols[:3]:  # 只测试前3个，避免API限制
        test_alpaca_for_symbol(symbol)
        test_finnhub_volume(symbol)
    
    print(f"\n{'='*80}")
    print("测试完成")
    print("="*80)