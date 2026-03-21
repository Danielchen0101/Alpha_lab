import os
import sys

print("检查后端错误日志...")

log_file = 'backend_errors.log'
if os.path.exists(log_file):
    print(f"日志文件存在，大小: {os.path.getsize(log_file)} bytes")
    
    try:
        with open(log_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if content:
            print(f"\n=== 错误日志内容 (最后1000字符) ===")
            print(content[-1000:] if len(content) > 1000 else content)
        else:
            print("日志文件为空")
    except Exception as e:
        print(f"读取日志文件失败: {e}")
else:
    print("日志文件不存在")

print(f"\n=== 测试Dashboard接口 ===")
import requests

# 测试Dashboard接口
url = "http://127.0.0.1:8890/api/market/stocks"
params = {'dashboard': 'true'}

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"返回数据条数: {data.get('count', 0)}")
        print(f"数据源: {data.get('dataSource', 'N/A')}")
        
        if 'stocks' in data and data['stocks']:
            print(f"\n第一支股票数据:")
            first_stock = data['stocks'][0]
            for key in ['symbol', 'name', 'price', 'change', 'changePercent', 'marketCap', 'industry']:
                if key in first_stock:
                    print(f"  {key}: {first_stock[key]}")
    else:
        print(f"响应内容: {response.text[:500]}")
        
except Exception as e:
    print(f"请求失败: {e}")
    import traceback
    traceback.print_exc()