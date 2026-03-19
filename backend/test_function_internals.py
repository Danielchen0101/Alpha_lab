import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入函数
from quant_backend import get_stock_detail, get_stock_history, get_stocks

print("=== Testing Function Internals ===")

# 模拟Flask请求上下文
from flask import Flask

app = Flask(__name__)

# 测试 get_stock_detail
print("\n1. Testing get_stock_detail function...")
try:
    with app.test_request_context():
        # 调用函数
        result = get_stock_detail('AAPL')
        print(f"   Result type: {type(result)}")
        if hasattr(result, 'status_code'):
            print(f"   Status code: {result.status_code}")
            print(f"   Response: {result.get_data(as_text=True)[:200]}")
        else:
            print(f"   Direct return: {result}")
except Exception as e:
    print(f"   ERROR in get_stock_detail: {e}")
    import traceback
    traceback.print_exc()

# 测试 get_stocks
print("\n2. Testing get_stocks function...")
try:
    with app.test_request_context():
        result = get_stocks()
        print(f"   Result type: {type(result)}")
        if hasattr(result, 'status_code'):
            print(f"   Status code: {result.status_code}")
            print(f"   Response: {result.get_data(as_text=True)[:200]}")
        else:
            print(f"   Direct return: {result}")
except Exception as e:
    print(f"   ERROR in get_stocks: {e}")
    import traceback
    traceback.print_exc()

# 测试 get_stock_history
print("\n3. Testing get_stock_history function...")
try:
    with app.test_request_context():
        result = get_stock_history('AAPL')
        print(f"   Result type: {type(result)}")
        if hasattr(result, 'status_code'):
            print(f"   Status code: {result.status_code}")
            print(f"   Response: {result.get_data(as_text=True)[:200]}")
        else:
            print(f"   Direct return: {result}")
except Exception as e:
    print(f"   ERROR in get_stock_history: {e}")
    import traceback
    traceback.print_exc()

print("\n=== Testing Complete ===")