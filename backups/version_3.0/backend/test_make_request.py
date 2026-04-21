import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 模拟 start_quant_backend.py 中的环境
ALPACA_API_KEY = 'PK47HFNRVYZ7XZLLLYUULBIY4R'
ALPACA_API_SECRET = '6CgiJaMDvref9uoHRUph8qMyBKJyHbRxPrGHgKYq2T5g'
ALPACA_BASE_URL = 'https://paper-api.alpaca.markets/v2'

import requests

def make_alpaca_request(method, endpoint, data=None):
    """发送请求到 Alpaca API"""
    import sys
    url = f"{ALPACA_BASE_URL}{endpoint}"
    headers = {
        'APCA-API-KEY-ID': ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        'Content-Type': 'application/json'
    }
    
    try:
        print(f"Alpaca {method} 请求: {url}")
        sys.stdout.flush()
        if data:
            print(f"请求数据: {data}")
            sys.stdout.flush()
        
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=10)
        elif method == 'POST':
            response = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == 'DELETE':
            response = requests.delete(url, headers=headers, timeout=10)
        else:
            return None
        
        print(f"Alpaca API 响应状态: {response.status_code}")
        sys.stdout.flush()
        print(f"响应内容: {response.text[:500]}...")  # 只打印前500个字符
        sys.stdout.flush()
        
        # 处理响应状态码
        if response.status_code == 204:
            # 204 No Content 是 DELETE 请求的正常响应
            print("DELETE 请求成功，返回 204 No Content")
            return {'success': True, 'message': '订单取消成功'}
        elif 200 <= response.status_code < 300:
            # 其他成功状态码
            if response.text and response.text.strip():
                try:
                    json_data = response.json()
                    print(f"JSON 解析成功，类型: {type(json_data)}")
                    
                    # 处理不同的返回数据结构
                    if isinstance(json_data, dict):
                        # 如果是字典，确保包含 success 字段
                        if 'success' not in json_data:
                            json_data['success'] = True
                        return json_data
                    elif isinstance(json_data, list):
                        # 如果是列表（如订单列表），包装成字典
                        print(f"返回列表，长度: {len(json_data)}")
                        return {
                            'success': True,
                            'data': json_data  # 将列表放在 'data' 字段中
                        }
                    else:
                        # 其他类型
                        return {'success': True, 'data': json_data}
                except Exception as json_error:
                    print(f"JSON 解析错误: {json_error}")
                    return {'success': True, 'message': '请求成功', 'raw': response.text}
            else:
                print("响应内容为空")
                return {'success': True, 'message': '请求成功'}
        else:
            # 错误状态码
            print(f"Alpaca API 错误: {response.status_code}")
            try:
                error_data = response.json()
                return {'success': False, 'error': error_data}
            except:
                return {'success': False, 'error': f'HTTP {response.status_code}: {response.text}'}
            
    except requests.exceptions.RequestException as e:
        print(f"Alpaca API 异常: {e}")
        return None

# 测试函数
print("测试 make_alpaca_request 函数:")
result = make_alpaca_request('GET', '/orders?status=all&limit=50&direction=desc')
print(f"\n返回结果类型: {type(result)}")
if result:
    print(f"返回结果键: {list(result.keys()) if isinstance(result, dict) else '不是字典'}")
    if isinstance(result, dict) and 'data' in result:
        print(f"data 字段类型: {type(result['data'])}")
        if isinstance(result['data'], list):
            print(f"订单数量: {len(result['data'])}")
            if len(result['data']) > 0:
                print(f"第一个订单状态: {result['data'][0].get('status', 'N/A')}")