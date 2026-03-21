import requests
import json
from datetime import datetime, timedelta

TWELVEDATA_API_KEY = '8b847a1ef2aa47a68d3f992bd0275f0c'

# 测试Twelve Data 1 Year请求
print("测试Twelve Data 1 Year请求...")

# 计算时间范围
end_date = datetime.now() + timedelta(days=1)  # 到明天
start_date = datetime.now() - timedelta(days=366)  # 去年的今天减一天

start_str = start_date.strftime('%Y-%m-%d')
end_str = end_date.strftime('%Y-%m-%d')

print(f"时间范围: {start_str} 到 {end_str}")

# 测试1: 使用start_date和end_date
url1 = "https://api.twelvedata.com/time_series"
params1 = {
    'symbol': 'AAPL',
    'interval': '1day',
    'outputsize': 400,
    'start_date': start_str,
    'end_date': end_str,
    'apikey': TWELVEDATA_API_KEY,
    'format': 'JSON'
}

print(f"\n=== 测试1: 使用start_date和end_date ===")
print(f"参数: {params1}")

try:
    response1 = requests.get(url1, params=params1, timeout=10)
    print(f"状态码: {response1.status_code}")
    
    if response1.status_code == 200:
        data1 = response1.json()
        if 'values' in data1:
            values1 = data1['values']
            print(f"返回数据点数量: {len(values1)}")
            
            if values1:
                print(f"前3个数据点:")
                for i, item in enumerate(values1[:3]):
                    print(f"  {i+1}. {item.get('datetime', 'N/A')}: {item.get('close', 'N/A')}")
                
                print(f"最后3个数据点:")
                for i, item in enumerate(values1[-3:]):
                    print(f"  {len(values1)-2+i}. {item.get('datetime', 'N/A')}: {item.get('close', 'N/A')}")
        else:
            print(f"响应中没有'values'字段")
            print(f"响应: {json.dumps(data1, indent=2)[:500]}")
    else:
        print(f"请求失败: {response1.text}")
        
except Exception as e:
    print(f"测试1失败: {e}")

# 测试2: 只使用outputsize（不使用start_date/end_date）
print(f"\n=== 测试2: 只使用outputsize ===")
params2 = {
    'symbol': 'AAPL',
    'interval': '1day',
    'outputsize': 400,  # 请求400个数据点
    'apikey': TWELVEDATA_API_KEY,
    'format': 'JSON'
}

print(f"参数: {params2}")

try:
    response2 = requests.get(url1, params=params2, timeout=10)
    print(f"状态码: {response2.status_code}")
    
    if response2.status_code == 200:
        data2 = response2.json()
        if 'values' in data2:
            values2 = data2['values']
            print(f"返回数据点数量: {len(values2)}")
            
            if values2:
                print(f"前3个数据点:")
                for i, item in enumerate(values2[:3]):
                    print(f"  {i+1}. {item.get('datetime', 'N/A')}: {item.get('close', 'N/A')}")
                
                print(f"最后3个数据点:")
                for i, item in enumerate(values2[-3:]):
                    print(f"  {len(values2)-2+i}. {item.get('datetime', 'N/A')}: {item.get('close', 'N/A')}")
                
                # 检查日期范围
                if values2:
                    first_date = values2[-1].get('datetime', '')  # 注意：Twelve Data返回倒序
                    last_date = values2[0].get('datetime', '')
                    print(f"日期范围: {first_date} 到 {last_date}")
        else:
            print(f"响应中没有'values'字段")
            print(f"响应: {json.dumps(data2, indent=2)[:500]}")
    else:
        print(f"请求失败: {response2.text}")
        
except Exception as e:
    print(f"测试2失败: {e}")