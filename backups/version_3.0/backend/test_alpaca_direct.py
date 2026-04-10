import requests
import json

ALPACA_API_KEY = 'PK47HFNRVYZ7XZLLLYUULBIY4R'
ALPACA_API_SECRET = '6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g'
ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2'

def test_alpaca_orders_direct():
    """直接测试 Alpaca orders API"""
    url = f"{ALPACA_BASE_URL}/orders?status=all&limit=50&direction=desc"
    headers = {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Content-Type': 'application/json'
    }
    
    print(f"直接测试 Alpaca orders API: {url}")
    print(f"API Key: {ALPACA_API_KEY[:10]}...")
    print(f"API Secret: {ALPACA_API_SECRET[:10]}...")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"响应状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"响应数据 (类型: {type(data)}):")
                if isinstance(data, list):
                    print(f"订单数量: {len(data)}")
                    if len(data) > 0:
                        print(f"第一个订单: {json.dumps(data[0], indent=2)}")
                else:
                    print(f"数据: {json.dumps(data, indent=2)}")
            except Exception as json_error:
                print(f"JSON 解析错误: {json_error}")
                print(f"原始响应: {response.text[:500]}")
        else:
            print(f"API 错误: {response.status_code}")
            print(f"错误响应: {response.text}")
            
    except Exception as e:
        print(f"异常: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    test_alpaca_orders_direct()