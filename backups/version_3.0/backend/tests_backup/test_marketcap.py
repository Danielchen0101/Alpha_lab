"""
最简单的market cap测试版本 - 硬编码数据
"""
from flask import Flask, jsonify
import time

app = Flask(__name__)

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """股票列表接口 - 硬编码market cap数据"""
    import sys
    print(f"\n[测试] ========== /api/market/stocks 被调用 ==========", file=sys.stderr)
    sys.stderr.flush()
    
    # 硬编码的market cap数据（单位：美元）
    market_caps = {
        'AAPL': 3640775919598.978,    # 3.64万亿美元
        'TSLA': 1380744791998.3203,   # 1.38万亿美元
        'AMD': 328250631048.9196,     # 3280亿美元
        'NVDA': 1720000000000.0,      # 1.72万亿美元
        'MSFT': 3800000000000.0,      # 3.8万亿美元
        'GOOGL': 2200000000000.0,     # 2.2万亿美元
        'AMZN': 2100000000000.0,      # 2.1万亿美元
        'META': 1500000000000.0,      # 1.5万亿美元
        'NFLX': 420000000000.0,       # 4200亿美元
        'INTC': 180000000000.0        # 1800亿美元
    }
    
    # 股票名称映射
    STOCK_NAMES = {
        'AAPL': 'Apple Inc.',
        'MSFT': 'Microsoft Corporation',
        'GOOGL': 'Alphabet Inc.',
        'AMZN': 'Amazon.com Inc.',
        'TSLA': 'Tesla Inc.',
        'NVDA': 'NVIDIA Corporation',
        'META': 'Meta Platforms Inc.',
        'NFLX': 'Netflix Inc.',
        'AMD': 'Advanced Micro Devices Inc.',
        'INTC': 'Intel Corporation'
    }
    
    # 股票行业映射
    STOCK_SECTORS = {
        'AAPL': 'Technology',
        'MSFT': 'Technology',
        'GOOGL': 'Communication Services',
        'AMZN': 'Consumer Cyclical',
        'TSLA': 'Consumer Cyclical',
        'NVDA': 'Technology',
        'META': 'Communication Services',
        'NFLX': 'Communication Services',
        'AMD': 'Technology',
        'INTC': 'Technology'
    }
    
    # 硬编码的价格数据（真实数据）
    prices = {
        'AAPL': 248.01,
        'TSLA': 367.98,
        'AMD': 201.35,
        'NVDA': 172.72,
        'MSFT': 381.89,
        'GOOGL': 301.02,
        'AMZN': 205.39,
        'META': 593.68,
        'NFLX': 91.84,
        'INTC': 43.88
    }
    
    changes = {
        'AAPL': -0.95,
        'TSLA': -12.32,
        'AMD': -3.92,
        'NVDA': -5.84,
        'MSFT': -7.13,
        'GOOGL': -6.11,
        'AMZN': -3.37,
        'META': -13.02,
        'NFLX': 0.1,
        'INTC': -2.3
    }
    
    change_percents = {
        'AAPL': -0.3816,
        'TSLA': -3.2395,
        'AMD': -1.9097,
        'NVDA': -3.2706,
        'MSFT': -1.8328,
        'GOOGL': -1.9894,
        'AMZN': -1.6143,
        'META': -2.146,
        'NFLX': 0.109,
        'INTC': -4.9805
    }
    
    stocks = []
    
    for symbol in ['AAPL', 'TSLA', 'AMD', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NFLX', 'INTC']:
        stock_data = {
            "symbol": symbol,
            "name": STOCK_NAMES.get(symbol, f"{symbol} Inc."),
            "price": prices.get(symbol),
            "change": changes.get(symbol),
            "changePercent": change_percents.get(symbol),
            "marketCap": market_caps.get(symbol),  # 硬编码的market cap
            "currency": "USD",
            "exchange": "NASDAQ",
            "industry": STOCK_SECTORS.get(symbol, "Technology"),
            "sector": STOCK_SECTORS.get(symbol, "Technology"),
            "dataSource": "硬编码测试数据",
            "timestamp": int(time.time())
        }
        stocks.append(stock_data)
        
        print(f"[测试] {symbol}: price=${prices.get(symbol)}, marketCap={market_caps.get(symbol)}", file=sys.stderr)
        sys.stderr.flush()
    
    print(f"[测试] 返回 {len(stocks)} 支股票数据，全部包含market cap", file=sys.stderr)
    sys.stderr.flush()
    
    return jsonify({
        "stocks": stocks,
        "count": len(stocks),
        "dataSource": "硬编码测试数据",
        "timestamp": int(time.time())
    }), 200

if __name__ == '__main__':
    import sys
    print("================================================================================", file=sys.stderr)
    print("Market Cap测试版后端启动", file=sys.stderr)
    print("端口: 8889", file=sys.stderr)
    print("全部数据硬编码，包含market cap", file=sys.stderr)
    print("================================================================================\n", file=sys.stderr)
    sys.stderr.flush()
    
    app.run(host='127.0.0.1', port=8889, debug=True, use_reloader=False)