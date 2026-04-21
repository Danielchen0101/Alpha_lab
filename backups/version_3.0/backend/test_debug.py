import requests
import json

def test_debug():
    """调试测试"""
    # 测试直接调用 Alpaca API
    ALPACA_API_KEY = 'PK47HFNRVYZ7XZLLLYUULBIY4R'
    ALPACA_API_SECRET = '6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g'
    ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2'
    
    url = f"{ALPACA_BASE_URL}/orders?status=all&limit=50&direction=desc"
    headers = {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Content-Type': 'application/json'
    }
    
    print("1. 直接测试 Alpaca API:")
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   订单数量: {len(data) if isinstance(data, list) else '不是列表'}")
            if isinstance(data, list) and len(data) > 0:
                print(f"   第一个订单状态: {data[0].get('status', 'N/A')}")
                print(f"   第一个订单ID: {data[0].get('id', 'N/A')}")
        else:
            print(f"   错误: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")
    
    print("\n2. 测试我们的 backend:")
    try:
        response = requests.get("http://127.0.0.1:8889/api/broker/orders", timeout=10)
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")
    
    print("\n3. 测试 positions:")
    try:
        response = requests.get("http://127.0.0.1:8889/api/broker/positions", timeout=10)
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.text}")
    except Exception as e:
        print(f"   异常: {e}")

if __name__ == '__main__':
    test_debug()