import requests
import json

# 测试后端API
url = "http://127.0.0.1:8889/api/market/history/AAPL"
params = {
    'interval': 'D',
    'range': '1month'
}

print(f"测试后端API: {url}")
print(f"参数: {params}")

try:
    response = requests.get(url, params=params, timeout=30)
    print(f"状态码: {response.status_code}")
    print(f"响应头: {dict(response.headers)}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"响应数据: {json.dumps(data, indent=2)}")
        
        if data.get('count', 0) > 0:
            print(f"成功返回 {data['count']} 个数据点")
            if 'data' in data and len(data['data']) > 0:
                print(f"第一个数据点: {data['data'][0]}")
        else:
            print(f"返回空数据")
            print(f"数据源: {data.get('dataSource', 'N/A')}")
            print(f"警告: {data.get('warning', 'N/A')}")
            print(f"备注: {data.get('note', 'N/A')}")
    else:
        print(f"HTTP错误: {response.status_code}")
        print(f"响应文本: {response.text[:500]}")
        
except Exception as e:
    print(f"请求异常: {e}")
    import traceback
    traceback.print_exc()