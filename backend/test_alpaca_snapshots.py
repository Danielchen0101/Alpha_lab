import requests
import json

# Alpaca 配置
api_key = 'PKFQZZXERLVJLJHODHPPEB52RD'
api_secret = '5odo2jBF7YFLa7DAvss3hV7WVXE789ktTor7zMyPewxa'

headers = {
    'APCA-API-KEY-ID': api_key,
    'APCA-API-SECRET-KEY': api_secret
}

def test_snapshots_endpoint():
    """测试Alpaca snapshots endpoint"""
    print(f"{'='*60}")
    print(f"测试 Alpaca snapshots endpoint")
    print(f"{'='*60}")
    
    # 测试单个symbol
    symbols = ['AAPL', 'NVDA']
    symbols_param = ','.join(symbols)
    
    snapshots_url = f'https://data.alpaca.markets/v2/stocks/snapshots?symbols={symbols_param}'
    
    print(f"\n1. 测试snapshots endpoint")
    print(f"   URL: {snapshots_url}")
    
    try:
        response = requests.get(snapshots_url, headers=headers, timeout=10)
        print(f"   状态码: {response.status_code}")
        print(f"   响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   响应体结构: {json.dumps(data, indent=4)}")
            
            # 分析每个symbol的数据结构
            for symbol in symbols:
                if symbol in data:
                    snapshot = data[symbol]
                    print(f"\n   === {symbol} snapshot 结构 ===")
                    print(f"   所有字段: {list(snapshot.keys())}")
                    
                    # 检查各个子字段
                    if 'latestTrade' in snapshot:
                        trade = snapshot['latestTrade']
                        print(f"   latestTrade字段: {list(trade.keys())}")
                        print(f"     p (价格): {trade.get('p')}")
                        print(f"     s (成交量): {trade.get('s')}")
                        print(f"     x (交易所): {trade.get('x')}")
                        print(f"     t (时间戳): {trade.get('t')}")
                    
                    if 'latestQuote' in snapshot:
                        quote = snapshot['latestQuote']
                        print(f"   latestQuote字段: {list(quote.keys())}")
                        print(f"     bp (买价): {quote.get('bp')}")
                        print(f"     ap (卖价): {quote.get('ap')}")
                        print(f"     bs (买量): {quote.get('bs')}")
                        print(f"     as (卖量): {quote.get('as')}")
                        print(f"     bx (买交易所): {quote.get('bx')}")
                        print(f"     ax (卖交易所): {quote.get('ax')}")
                    
                    if 'minuteBar' in snapshot:
                        minute_bar = snapshot['minuteBar']
                        print(f"   minuteBar字段: {list(minute_bar.keys())}")
                        print(f"     o (开盘价): {minute_bar.get('o')}")
                        print(f"     h (最高价): {minute_bar.get('h')}")
                        print(f"     l (最低价): {minute_bar.get('l')}")
                        print(f"     c (收盘价): {minute_bar.get('c')}")
                        print(f"     v (成交量): {minute_bar.get('v')}")
                        print(f"     t (时间戳): {minute_bar.get('t')}")
                    
                    if 'dailyBar' in snapshot:
                        daily_bar = snapshot['dailyBar']
                        print(f"   dailyBar字段: {list(daily_bar.keys())}")
                        print(f"     o (开盘价): {daily_bar.get('o')}")
                        print(f"     h (最高价): {daily_bar.get('h')}")
                        print(f"     l (最低价): {daily_bar.get('l')}")
                        print(f"     c (收盘价): {daily_bar.get('c')}")
                        print(f"     v (成交量): {daily_bar.get('v')}")
                        print(f"     t (时间戳): {daily_bar.get('t')}")
                    
                    if 'prevDailyBar' in snapshot:
                        prev_daily_bar = snapshot['prevDailyBar']
                        print(f"   prevDailyBar字段: {list(prev_daily_bar.keys())}")
                        print(f"     o (开盘价): {prev_daily_bar.get('o')}")
                        print(f"     h (最高价): {prev_daily_bar.get('h')}")
                        print(f"     l (最低价): {prev_daily_bar.get('l')}")
                        print(f"     c (收盘价): {prev_daily_bar.get('c')}")
                        print(f"     v (成交量): {prev_daily_bar.get('v')}")
                        print(f"     t (时间戳): {prev_daily_bar.get('t')}")
                else:
                    print(f"\n   {symbol} 不在snapshots响应中")
        else:
            print(f"   错误响应: {response.text}")
            
    except Exception as e:
        print(f"   异常: {e}")

if __name__ == '__main__':
    test_snapshots_endpoint()