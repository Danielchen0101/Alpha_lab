from flask import Flask, jsonify
import sys
import os

# 创建简单的Flask应用
app = Flask(__name__)

# 添加CORS
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# 简单的测试路由
@app.route('/api/test/history/<symbol>', methods=['GET'])
def test_get_stock_history(symbol):
    print(f"\n[TEST] /api/test/history/{symbol} 被调用")
    return jsonify({
        "data": [{"time": "2026-03-20", "close": 247.99}],
        "count": 1,
        "dataSource": "测试数据",
        "timestamp": 1774137013
    }), 200

# 打印所有路由
print("测试应用启动...")
print("注册的路由:")
for rule in app.url_map.iter_rules():
    print(f"  {rule.rule} -> {rule.endpoint}")

if __name__ == '__main__':
    app.run(port=8892, debug=False)