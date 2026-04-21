import requests
import json

ALPACA_API_KEY = 'PK47HFNRVYZ7XZLLLYUULBIY4R'
ALPACA_API_SECRET = '6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g'
ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2'

def test_alpaca_positions():
    """测试 Alpaca positions API"""
    url = f"{ALPACA_BASE_URL}/positions"
    headers = {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Content-Type': 'application/json'
    }
    
    print(f"测试 Alpaca positions API: {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"持仓数据 (类型: {type(data)}):")
            if isinstance(data, list):
                print(f"持仓数量: {len(data)}")
                for i, pos in enumerate(data[:3]):  # 只显示前3个
                    print(f"  持仓 {i+1}: {json.dumps(pos, indent=2)}")
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
    success = test_alpaca_positions()
    if success:
        print("Alpaca positions API 测试完成!")
    else:
        print("Alpaca positions API 测试失败!")