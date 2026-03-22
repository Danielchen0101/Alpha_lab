import sys
import os
from flask import Flask, request, jsonify
import time

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 创建测试Flask应用
app = Flask(__name__)

# 导入后端函数
from start_quant_backend import get_twelvedata_history

@app.route('/test/history/<symbol>', methods=['GET'])
def test_get_stock_history(symbol):
    """测试API路由"""
    print(f"\n{'='*80}")
    print(f"[TEST API ROUTE] /test/history/{symbol} 被调用")
    
    try:
        interval = request.args.get('interval', '60')
        range_param = request.args.get('range', '1week')
        
        print(f"[TEST API ROUTE] 实际收到参数: symbol={symbol}, interval={interval}, range={range_param}")
        print(f"[TEST API ROUTE] 完整URL: {request.url}")
        
        # 从Twelve Data获取图表数据
        print(f"[TEST API ROUTE] 调用get_twelvedata_history函数...")
        historical_data, success, data_source_note = get_twelvedata_history(symbol, interval, range_param)
        
        print(f"[TEST API ROUTE] 函数返回结果:")
        print(f"  success: {success}")
        print(f"  note: '{data_source_note}'")
        print(f"  数据点数: {len(historical_data)}")
        
        if success and historical_data:
            response_data = {
                "data": historical_data,
                "count": len(historical_data),
                "dataSource": "Twelve Data (图表数据)",
                "note": data_source_note,
                "timestamp": int(time.time())
            }
            print(f"[TEST API ROUTE] 成功返回 {len(historical_data)} 个数据点")
            print(f"{'='*80}\n")
            return jsonify(response_data), 200
        else:
            response_data = {
                "data": [],
                "count": 0,
                "dataSource": "Twelve Data (图表数据获取失败)",
                "note": "无法获取图表数据",
                "warning": data_source_note,
                "timestamp": int(time.time())
            }
            print(f"[TEST API ROUTE] 图表数据获取失败: {data_source_note}")
            print(f"{'='*80}\n")
            return jsonify(response_data), 200
            
    except Exception as e:
        print(f"[TEST API ROUTE] 异常: {e}")
        import traceback
        traceback.print_exc()
        print(f"{'='*80}\n")
        
        return jsonify({
            "data": [],
            "count": 0,
            "dataSource": "Twelve Data (异常)",
            "note": "无法获取图表数据",
            "timestamp": int(time.time())
        }), 200

if __name__ == '__main__':
    print("启动测试服务器...")
    app.run(port=8891, debug=False)