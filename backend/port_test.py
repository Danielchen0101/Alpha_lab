from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api/market/history/<symbol>')
def test(symbol):
    print(f"!!! 收到请求: /api/market/history/{symbol}")
    return jsonify({"symbol": symbol, "status": "success"})

if __name__ == '__main__':
    print("测试端口8890...")
    app.run(host='127.0.0.1', port=8890, debug=True)