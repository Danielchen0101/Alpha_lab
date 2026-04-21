import requests
import json

ALPACA_API_KEY = 'PK47HFNRVYZ7XZLLLYUULBIY4R'
ALPACA_API_SECRET = '6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g'
ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2'

def test_alpaca_api():
    """测试 Alpaca API 连接"""
    url = f"{ALPACA_BASE_URL}/account"
    headers = {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Content-Type': 'application/json'
    }
    
    print(f"测试 Alpaca API 连接: {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"账户信息: {json.dumps(data, indent=2)}")
            return True
        else:
            print(f"API 错误: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"异常: {e}")
        return False

if __name__ == '__main__':
    success = test_alpaca_api()
    if success:
        print("Alpaca API 连接测试成功!")
    else:
        print("Alpaca API 连接测试失败!")