from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/api/market/history/<symbol>', methods=['GET'])
def test_route(symbol):
    return jsonify({"symbol": symbol, "status": "ok"})

@app.route('/')
def home():
    return "Server is running"

if __name__ == '__main__':
    print("Starting minimal server...")
    print("Routes:")
    print("  - /api/market/history/<symbol>")
    print("  - /")
    app.run(host='127.0.0.1', port=8889, debug=True)