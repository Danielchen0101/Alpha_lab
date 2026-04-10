import requests
import json

# 直接测试Twelve Data API，模拟后端参数
TWELVEDATA_API_KEY = '3541c054d16843cb8e4b2ccefa456a01'

# 模拟后端参数：interval='D' -> '1day', range='1month'
params = {
    'symbol': 'AAPL',
    'interval': '1day',  # 映射后的值
    'outputsize': 40,    # 1个月大约40个交易日
    'apikey': TWELVEDATA_API_KEY,
    'format': 'JSON'
}

url = "https://api.twelvedata.com/time_series"

print(f"测试Twelve Data API: {url}")
print(f"参数: {params}")

try:
    response = requests.get(url, params=params, timeout=15)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n响应状态: {data.get('status', 'unknown')}")
        print(f"响应消息: {data.get('message', 'N/A')}")
        print(f"响应代码: {data.get('code', 'N/A')}")
        
        # 检查所有字段
        print(f"\n响应字段: {list(data.keys())}")
        
        # 检查数据字段
        values = None
        if 'values' in data:
            values = data['values']
            print("找到小写'values'字段")
        elif 'Values' in data:
            values = data['Values']
            print("找到大写'Values'字段")
        elif 'data' in data:
            values = data['data']
            print("找到'data'字段")
        elif 'Data' in data:
            values = data['Data']
            print("找到'Data'字段")
        
        if values is not None:
            print(f"数据点数: {len(values)}")
            if len(values) > 0:
                print(f"第一个数据点: {values[0]}")
        else:
            print("没有找到数据字段")
            print(f"完整响应: {json.dumps(data, indent=2)[:500]}...")
            
    else:
        print(f"HTTP错误: {response.status_code}")
        print(f"响应: {response.text[:500]}")
        
except Exception as e:
    print(f"请求异常: {e}")
    import traceback
    traceback.print_exc()