import requests
import time

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

def fetch_real_stock_data(symbol):
    """Fetch real stock data from Finnhub API"""
    try:
        # 使用Finnhub quote API获取实时数据
        url = f"{FINNHUB_BASE_URL}/quote"
        params = {
            'symbol': symbol.upper(),
            'token': FINNHUB_API_KEY
        }
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            print(f"Finnhub quote API错误: {response.status_code}")
            return None
            
        quote_data = response.json()
        
        # Finnhub quote API返回字段:
        # c: current price
        # d: change
        # dp: percent change
        # h: high price of the day
        # l: low price of the day
        # o: open price
        # pc: previous close price
        # t: timestamp
        
        current_price = quote_data.get('c')
        change = quote_data.get('d')
        change_percent = quote_data.get('dp')
        day_high = quote_data.get('h')
        day_low = quote_data.get('l')
        prev_close = quote_data.get('pc')
        
        if current_price is None:
            print(f"Finnhub未返回 {symbol} 的价格数据")
            return None
        
        # 获取公司基本信息
        stock_data = {
            "symbol": symbol.upper(),
            "name": f"{symbol.upper()} Corp.",  # Finnhub没有公司名，需要其他API
            "price": round(current_price, 2),
            "change": round(change, 2) if change is not None else 0,
            "changePercent": round(change_percent, 2) if change_percent is not None else 0,
            "volume": 0,  # quote API没有volume
            "marketCap": 0,  # 需要其他API
            "sector": "Unknown",  # 需要其他API
            "currency": "USD",
            "dayHigh": round(day_high, 2) if day_high is not None else None,
            "dayLow": round(day_low, 2) if day_low is not None else None,
            "previousClose": round(prev_close, 2) if prev_close is not None else None,
            "dataSource": "Finnhub",
            "timestamp": time.time()
        }
        
        return stock_data
        
    except Exception as e:
        print(f"Error fetching Finnhub data for {symbol}: {e}")
        return None

# 测试函数
if __name__ == "__main__":
    print("测试Finnhub API...")
    data = fetch_real_stock_data("AAPL")
    if data:
        print(f"AAPL数据: {data}")
    else:
        print("获取数据失败")