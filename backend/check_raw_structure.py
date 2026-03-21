import requests
import json

# 直接检查Twelve Data返回的数据结构
TWELVEDATA_API_KEY = '8b847a1ef2aa47a68d3f992bd0275f0c'

url = "https://api.twelvedata.com/time_series"
params = {
    'symbol': 'AAPL',
    'interval': '1day',
    'outputsize': 5,  # 只请求5个数据点用于测试
    'apikey': TWELVEDATA_API_KEY,
    'format': 'JSON'
}

print("检查Twelve Data返回的数据结构...")

try:
    response = requests.get(url, params=params, timeout=10)
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"\n=== 完整响应结构 ===")
        print(f"响应键: {list(data.keys())}")
        
        if 'meta' in data:
            print(f"\nmeta字段: {json.dumps(data['meta'], indent=2)}")
        
        if 'values' in data:
            values = data['values']
            print(f"\nvalues字段: {len(values)} 个数据点")
            
            if values:
                print(f"\n第一个数据点的完整结构:")
                print(json.dumps(values[0], indent=2))
                
                print(f"\n所有数据点的字段:")
                first_item = values[0]
                print(f"字段名: {list(first_item.keys())}")
                
                # 检查datetime字段
                print(f"\n=== datetime字段检查 ===")
                for i, item in enumerate(values):
                    datetime_val = item.get('datetime')
                    print(f"  数据点 {i+1}: datetime = '{datetime_val}' (类型: {type(datetime_val)})")
        
        else:
            print(f"\n响应中没有'values'字段")
            print(f"响应内容: {json.dumps(data, indent=2)}")
    else:
        print(f"请求失败: {response.status_code}")
        print(f"响应: {response.text}")
        
except Exception as e:
    print(f"测试失败: {e}")