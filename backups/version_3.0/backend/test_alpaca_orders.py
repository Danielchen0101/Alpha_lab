import requests
import json

ALPACA_API_KEY = 'PK47HFNRVYZ7XZLLLYUULBIY4R'
ALPACA_API_SECRET = '6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g'
ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2'

def test_alpaca_orders():
    """测试 Alpaca orders API"""
    url = f"{ALPACA_BASE_URL}/orders?status=all&limit=50&direction=desc"
    headers = {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Content-Type': 'application/json'
    }
    
    print(f"测试 Alpaca orders API: {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容: {response.text[:500]}...")  # 只显示前500个字符
        
        if response.status_code == 200:
            data = response.json()
            print(f"订单数据 (类型: {type(data)}):")
            if isinstance(data, list):
                print(f"订单数量: {len(data)}")
                for i, order in enumerate(data[:3]):  # 只显示前3个
                    print(f"  订单 {i+1}:")
                    print(f"    ID: {order.get('id', 'N/A')}")
                    print(f"    符号: {order.get('symbol', 'N/A')}")
                    print(f"    方向: {order.get('side', 'N/A')}")
                    print(f"    状态: {order.get('status', 'N/A')}")
                    print(f"    数量: {order.get('qty', 'N/A')}")
                    print(f"    类型: {order.get('type', 'N/A')}")
                    print(f"    创建时间: {order.get('created_at', 'N/A')}")
                    print(f"    成交数量: {order.get('filled_qty', 'N/A')}")
            else:
                print(f"  数据: {json.dumps(data, indent=2)}")
            return True
        else:
            print(f"API 错误: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"异常: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_alpaca_orders()
    if success:
        print("Alpaca orders API 测试完成!")
    else:
        print("Alpaca orders API 测试失败!")