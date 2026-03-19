from flask import Flask, jsonify
import os

app = Flask(__name__)

# 复制 get_stock_detail 函数
@app.route('/api/market/stock/<symbol>', methods=['GET'])
def get_stock_detail(symbol):
    """获取单个股票详细信息"""
    try:
        # 简单返回测试数据
        return jsonify({
            "symbol": symbol.upper(),
            "price": 100.0,
            "change": 1.5,
            "changePercent": 1.5,
            "name": f"{symbol} Inc.",
            "dataSource": "Test"
        })
    except Exception as e:
        return jsonify({
            "symbol": symbol.upper(),
            "error": str(e)
        }), 500

# 复制 get_stocks 函数
@app.route('/api/market/stocks', methods=['GET'])
def get_stocks():
    """获取股票市场数据"""
    return jsonify({
        "count": 10,
        "source": "Test",
        "stocks": [
            {"symbol": "AAPL", "price": 100.0},
            {"symbol": "MSFT", "price": 200.0}
        ]
    })

if __name__ == '__main__':
    print("路由表:")
    for rule in app.url_map.iter_rules():
        print(f"{rule.rule} -> {rule.endpoint}")
    
    port = 8891
    print(f"\n启动测试服务器在端口 {port}...")
    app.run(port=port, debug=False, use_reloader=False)