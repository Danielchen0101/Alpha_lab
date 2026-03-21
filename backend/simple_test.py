from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api/market/history/<symbol>')
def test_history(symbol):
    print(f"收到历史数据请求: {symbol}")
    return jsonify({"symbol": symbol, "status": "ok"})

@app.route('/api/market/stock/<symbol>')
def test_stock(symbol):
    print(f"收到单股详情请求: {symbol}")
    return jsonify({"symbol": symbol, "status": "ok"})

@app.route('/')
def home():
    return "Server is running"

if __name__ == '__main__':
    print("启动最简单的测试服务器...")
    print("路由:")
    print("  /api/market/history/<symbol>")
    print("  /api/market/stock/<symbol>")
    print("  /")
    app.run(host='127.0.0.1', port=8889, debug=True)