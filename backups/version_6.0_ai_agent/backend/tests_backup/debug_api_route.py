import sys
import os
import io
import contextlib

# 重定向输出到字符串
output = io.StringIO()

with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
    # 导入并调用函数
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    
    # 创建模拟的Flask请求上下文
    from flask import Flask, Request
    from werkzeug.test import EnvironBuilder
    
    app = Flask(__name__)
    
    # 导入函数
    from start_quant_backend import get_stock_history
    
    # 创建模拟请求
    with app.test_request_context('/api/market/history/AAPL?interval=D&range=1month'):
        print("=== 测试API路由 ===")
        print("调用 get_stock_history('AAPL')")
        
        try:
            # 直接调用函数
            import json
            from flask import jsonify
            
            # 调用函数
            result = get_stock_history('AAPL')
            
            print(f"\n函数返回: {result}")
            
            # 解析响应
            if isinstance(result, tuple) and len(result) == 2:
                response, status_code = result
                print(f"状态码: {status_code}")
                
                # 获取JSON数据
                if hasattr(response, 'get_json'):
                    data = response.get_json()
                else:
                    data = response
                    
                print(f"响应数据: {json.dumps(data, indent=2)}")
                
        except Exception as e:
            print(f"调用异常: {e}")
            import traceback
            traceback.print_exc()

# 打印所有输出
print("=== 完整输出 ===")
print(output.getvalue())