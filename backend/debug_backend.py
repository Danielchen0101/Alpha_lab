"""
调试后端错误
"""

from flask import Flask, jsonify
import requests
import time

app = Flask(__name__)

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    """最简单的股票列表接口"""
    print("调用 /api/market/stocks")
    
    try:
        # 测试Finnhub API
        symbol = 'AAPL'
        quote_url = f"{FINNHUB_BASE_URL}/quote"
        params = {
            'symbol': symbol,
            'token': FINNHUB_API_KEY
        }
        
        print(f"请求Finnhub: {quote_url}")
        response = requests.get(quote_url, params=params, timeout=5)
        print(f"Finnhub响应状态: {response.status_code}")
        
        if response.status_code == 200:
            quote_data = response.json()
            print(f"Finnhub数据: {quote_data}")
            
            stocks = [{
                "symbol": "AAPL",
                "name": "Apple Inc.",
                "price": quote_data.get('c', 0),
                "change": quote_data.get('c', 0) - quote_data.get('pc', 0),
                "changePercent": 0.5,
                "dataSource": "Finnhub (测试)"
            }]
            
            return jsonify({
                "stocks": stocks,
                "count": 1,
                "dataSource": "Finnhub (测试)",
                "timestamp": int(time.time())
            }), 200
        else:
            print(f"Finnhub错误: {response.text}")
            return jsonify({
                "stocks": [],
                "count": 0,
                "dataSource": f"Finnhub (错误: {response.status_code})",
                "timestamp": int(time.time())
            }), 200
            
    except Exception as e:
        print(f"异常: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "stocks": [],
            "count": 0,
            "dataSource": f"Finnhub (异常)",
            "timestamp": int(time.time())
        }), 200

if __name__ == '__main__':
    print("启动调试后端...")
    app.run(host='127.0.0.1', port=8891, debug=True)