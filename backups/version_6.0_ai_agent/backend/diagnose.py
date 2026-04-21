import requests
import json
import sys

def diagnose():
    """诊断 orders 接口问题"""
    
    print("=== 诊断开始 ===")
    
    # 1. 测试直接调用 Alpaca API
    print("\n1. 直接调用 Alpaca API:")
    ALPACA_API_KEY = 'PK47HFNRVYZ7XZLLLYUULBIY4R'
    ALPACA_API_SECRET = '6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g'
    ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2'
    
    url = f"{ALPACA_BASE_URL}/orders?status=all&limit=50&direction=desc"
    headers = {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   返回类型: {type(data)}")
            if isinstance(data, list):
                print(f"   订单数量: {len(data)}")
                if len(data) > 0:
                    print(f"   第一个订单:")
                    print(f"     ID: {data[0].get('id', 'N/A')}")
                    print(f"     状态: {data[0].get('status', 'N/A')}")
                    print(f"     符号: {data[0].get('symbol', 'N/A')}")
                    print(f"     方向: {data[0].get('side', 'N/A')}")
                    print(f"     数量: {data[0].get('qty', 'N/A')}")
                    print(f"     成交数量: {data[0].get('filled_qty', 'N/A')}")
            else:
                print(f"   数据: {json.dumps(data, indent=2)[:500]}")
        else:
            print(f"   错误: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")
    
    # 2. 测试我们的 backend
    print("\n2. 测试我们的 backend orders 接口:")
    try:
        response = requests.get("http://127.0.0.1:8889/api/broker/orders", timeout=10)
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")
        print("   (可能需要先启动 backend)")
    
    # 3. 测试 positions 接口
    print("\n3. 测试 positions 接口:")
    try:
        response = requests.get("http://127.0.0.1:8889/api/broker/positions", timeout=10)
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")
    
    print("\n=== 诊断结束 ===")