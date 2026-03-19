#!/usr/bin/env python3
"""
测试Yahoo Finance历史数据
"""

import yfinance as yf
from datetime import datetime

def test_yahoo_finance():
    """测试Yahoo Finance API"""
    print("=== Testing Yahoo Finance ===")
    
    # 测试AAPL
    symbol = "AAPL"
    
    try:
        # 获取ticker对象
        ticker = yf.Ticker(symbol)
        
        print(f"Ticker: {symbol}")
        print(f"Info keys: {list(ticker.info.keys())[:10]}...")
        
        # 测试不同时间段
        test_periods = [
            ('1d', '5m'),   # 1天，5分钟间隔
            ('5d', '1d'),   # 5天，日线
            ('1mo', '1d'),  # 1个月，日线
            ('3mo', '1d'),  # 3个月，日线
            ('1y', '1d'),   # 1年，日线
        ]
        
        for period, interval in test_periods:
            print(f"\n--- Period: {period}, Interval: {interval} ---")
            
            try:
                hist = ticker.history(period=period, interval=interval)
                
                if hist.empty:
                    print(f"  No data returned")
                else:
                    print(f"  Data shape: {hist.shape}")
                    print(f"  Columns: {list(hist.columns)}")
                    print(f"  Date range: {hist.index[0]} to {hist.index[-1]}")
                    print(f"  First row:")
                    print(f"    Open: {hist.iloc[0]['Open']:.2f}")
                    print(f"    High: {hist.iloc[0]['High']:.2f}")
                    print(f"    Low: {hist.iloc[0]['Low']:.2f}")
                    print(f"    Close: {hist.iloc[0]['Close']:.2f}")
                    print(f"    Volume: {hist.iloc[0]['Volume']:,}")
                    
            except Exception as e:
                print(f"  Error: {e}")
        
        # 测试实时数据
        print(f"\n--- Real-time Info ---")
        info = ticker.info
        print(f"  Current price: {info.get('currentPrice', 'N/A')}")
        print(f"  Market cap: {info.get('marketCap', 'N/A'):,}")
        print(f"  PE ratio: {info.get('trailingPE', 'N/A')}")
        print(f"  Dividend yield: {info.get('dividendYield', 'N/A')}")
        
        return True
        
    except Exception as e:
        print(f"Error testing Yahoo Finance: {e}")
        return False

if __name__ == "__main__":
    success = test_yahoo_finance()
    
    if success:
        print("\n✓ Yahoo Finance API works correctly")
    else:
        print("\n✗ Yahoo Finance API failed")