import requests
import json

print('测试单股详情接口...')
try:
    r = requests.get('http://127.0.0.1:8889/api/market/stock/AAPL', timeout=5)
    print(f'状态码: {r.status_code}')
    if r.status_code == 200:
        data = r.json()
        print(f'成功! 返回字段: {list(data.keys())}')
        print(f'symbol: {data.get("symbol")}')
        print(f'price: {data.get("price")}')
        print(f'完整响应: {json.dumps(data, indent=2, ensure_ascii=False)}')
    else:
        print(f'错误: {r.text}')
except requests.exceptions.Timeout:
    print('请求超时')
except Exception as e:
    print(f'错误: {e}')