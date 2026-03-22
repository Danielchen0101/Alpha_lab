import requests
import json

# 直接测试Twelve Data API
TWELVEDATA_API_KEY = '3541c054d16843cb8e4b2ccefa456a01'

# 测试1: 1个月日线数据
print("测试1: 1个月日线数据 (interval=D, range=1month)")
url = "https://api.twelvedata.com/time_series"
params = {
    'symbol': 'AAPL',
    'interval': '1day',
    'outputsize': '30',
    'apikey': TWELVEDATA_API_KEY
}

print(f"请求URL: {url}")
print(f"请求参数: {params}")
print(f"API密钥: {params['apikey'][:8]}... (长度: {len(params['apikey'])})")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"响应状态: {data.get('status', 'unknown')}")
        print(f"响应消息: {data.get('message', 'N/A')}")
        print(f"响应代码: {data.get('code', 'N/A')}")
        
        if data.get('status') == 'ok':
            values = data.get('values', [])
            print(f"返回数据点数: {len(values)}")
            if values:
                print("前3个数据点:")
                for i, item in enumerate(values[:3]):
                    print(f"  {i+1}. {item.get('datetime')}: 收盘价={item.get('close')}")
        else:
            print(f"API响应错误: {data}")
    else:
        print(f"HTTP错误: {response.status_code}")
        print(f"响应内容: {response.text[:500]}")
        
except Exception as e:
    print(f"请求异常: {e}")

print("\n" + "="*80 + "\n")

# 测试2: 检查API密钥状态
print("测试2: 检查API密钥状态")
status_url = "https://api.twelvedata.com/usage"
status_params = {'apikey': TWELVEDATA_API_KEY}

try:
    status_response = requests.get(status_url, params=status_params, timeout=10)
    print(f"状态码: {status_response.status_code}")
    if status_response.status_code == 200:
        status_data = status_response.json()
        print(f"API使用状态: {json.dumps(status_data, indent=2)}")
    else:
        print(f"状态检查失败: {status_response.text[:200]}")
except Exception as e:
    print(f"状态检查异常: {e}")