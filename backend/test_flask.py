from flask import Flask, jsonify
import time

app = Flask(__name__)

@app.route('/api/market/stocks', methods=['GET'])
def get_market_stocks():
    print("API被调用")
    try:
        # 返回最简单的数据
        stocks = [{
            "symbol": "AAPL",
            "name": "Apple Inc.",
            "price": 248.96,
            "change": -0.98,
            "changePercent": -0.39,
            "dataSource": "测试"
        }]
        
        return jsonify({
            "stocks": stocks,
            "count": 1,
            "dataSource": "测试",
            "timestamp": int(time.time())
        }), 200
    except Exception as e:
        print(f"异常: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("启动测试Flask应用...")
    app.run(host='127.0.0.1', port=8890, debug=True)