"""
简单后端 - 用于快速测试
"""
from flask import Flask, jsonify
import time

app = Flask(__name__)

@app.route('/api/system/status', methods=['GET'])
def get_status():
    """系统状态检查"""
    return jsonify({
        "status": "ok",
        "timestamp": int(time.time()),
        "version": "simple-backend-1.0",
        "message": "简单后端运行正常"
    })

@app.route('/api/market/history/<symbol>', methods=['GET'])
def get_stock_history(symbol):
    """模拟历史数据接口"""
    import random
    data = []
    base_price = 100 + random.random() * 50
    
    # 生成模拟数据
    for i in range(100):
        timestamp = int(time.time()) - i * 1800  # 每30分钟一个点
        price = base_price + random.random() * 10 - 5
        
        data.append({
            "timestamp": timestamp,
            "time": time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(timestamp)),
            "open": price,
            "high": price + random.random() * 2,
            "low": price - random.random() * 2,
            "close": price + random.random() * 1 - 0.5,
            "volume": int(random.random() * 1000000)
        })
    
    return jsonify({
        "data": data,
        "count": len(data),
        "dataSource": "模拟数据",
        "note": "简单后端模拟数据"
    })

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """模拟市场数据接口"""
    symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "JPM", "JNJ", "V"]
    stocks = []
    
    import random
    for symbol in symbols:
        base_price = 100 + random.random() * 200
        change = random.random() * 10 - 5
        
        stocks.append({
            "symbol": symbol,
            "name": f"{symbol} Inc.",
            "price": round(base_price, 2),
            "change": round(change, 2),
            "changePercent": round(change / base_price * 100, 2),
            "marketCap": round(random.random() * 1000000000000, 0),
            "dataSource": "模拟数据"
        })
    
    return jsonify({
        "stocks": stocks,
        "count": len(stocks),
        "dataSource": "模拟数据",
        "timestamp": int(time.time())
    })

if __name__ == '__main__':
    print("================================================")
    print("简单后端启动: simple_backend.py")
    print("端口: 8890")
    print("================================================")
    app.run(host='0.0.0.0', port=8890, debug=False)