import requests
import json

# 直接测试Twelve Data API
TWELVEDATA_API_KEY = '8b847a1ef2aa47a68d3f992bd0275f0c'

url = "https://api.twelvedata.com/time_series"
params = {
    'symbol': 'AAPL',
    'interval': '1day',  # 日线数据
    'outputsize': 90,    # 3个月约90天
    'apikey': TWELVEDATA_API_KEY,
    'format': 'JSON'
}

print("直接测试Twelve Data API 3 Months数据...")
print(f"URL: {url}")
print(f"参数: {params}")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"\n=== Twelve Data原始响应 ===")
        print(f"响应键: {list(data.keys())}")
        
        if 'values' in data:
            values = data['values']
            print(f"数据数量: {len(values)}")
            
            # 显示前5个和后5个数据点的原始datetime
            print(f"\n前5个数据点的原始datetime:")
            for i, item in enumerate(values[:5]):
                print(f"  {i+1}. datetime: '{item.get('datetime', 'N/A')}', close: {item.get('close', 'N/A')}")
            
            print(f"\n后5个数据点的原始datetime:")
            for i, item in enumerate(values[-5:]):
                print(f"  {len(values)-4+i}. datetime: '{item.get('datetime', 'N/A')}', close: {item.get('close', 'N/A')}")
            
            # 检查datetime格式
            print(f"\n=== datetime格式分析 ===")
            sample_datetime = values[0].get('datetime', '') if values else ''
            print(f"示例datetime: '{sample_datetime}'")
            print(f"长度: {len(sample_datetime)}")
            print(f"包含空格: {' ' in sample_datetime}")
            print(f"包含冒号: {':' in sample_datetime}")
            
            # 尝试解析日期
            from datetime import datetime
            try:
                if sample_datetime:
                    if ' ' in sample_datetime:
                        dt = datetime.strptime(sample_datetime, '%Y-%m-%d %H:%M:%S')
                        print(f"解析为日期时间: {dt}")
                        print(f"格式: 包含时间 (YYYY-MM-DD HH:MM:SS)")
                    else:
                        dt = datetime.strptime(sample_datetime, '%Y-%m-%d')
                        print(f"解析为日期: {dt}")
                        print(f"格式: 仅日期 (YYYY-MM-DD)")
            except Exception as e:
                print(f"解析失败: {e}")
            
            # 检查所有datetime是否相同
            datetimes = [item.get('datetime', '') for item in values]
            unique_datetimes = set(datetimes)
            print(f"\n=== datetime唯一性 ===")
            print(f"总数据点: {len(datetimes)}")
            print(f"唯一datetime: {len(unique_datetimes)}")
            if len(unique_datetimes) <= 5:
                print(f"唯一datetime列表: {list(unique_datetimes)[:10]}")
            
        else:
            print(f"响应中没有'values'字段")
            print(f"响应内容: {json.dumps(data, indent=2)[:500]}...")
    else:
        print(f"请求失败: {response.text}")
        
except Exception as e:
    print(f"测试失败: {e}")