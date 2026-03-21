import requests
import time
from datetime import datetime, timedelta

print("测试Polygon API支持的粒度...")

POLYGON_API_KEY = 'vx8LMXnMYMpBonwfXE2ssfqSo7WwcnlB'
POLYGON_BASE_URL = 'https://api.polygon.io'

# 测试不同的粒度
granularities = ['1', '5', '15', '30', '60', 'D', 'W', 'M']

now = datetime.now()
start_date = (now - timedelta(days=7)).strftime('%Y-%m-%d')
end_date = now.strftime('%Y-%m-%d')

for granularity in granularities:
    print(f"\n测试粒度: {granularity}")
    
    try:
        url = f"{POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/range/1/{granularity}/{start_date}/{end_date}"
        params = {
            'apiKey': POLYGON_API_KEY,
            'adjusted': 'true',
            'sort': 'asc'
        }
        
        print(f"请求URL: {url}")
        response = requests.get(url, params=params, timeout=10)
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"成功! 结果数量: {data.get('resultsCount', 0)}")
            print(f"状态: {data.get('status', '未知')}")
            
            if 'results' in data and data['results']:
                results = data['results']
                print(f"数据条数: {len(results)}")
                
                # 检查时间间隔
                if len(results) >= 2:
                    time_diff = (results[1]['t'] - results[0]['t']) / 1000  # 毫秒转秒
                    
                    if granularity == '1':
                        expected = 60  # 1分钟
                    elif granularity == '5':
                        expected = 300  # 5分钟
                    elif granularity == '15':
                        expected = 900  # 15分钟
                    elif granularity == '30':
                        expected = 1800  # 30分钟
                    elif granularity == '60':
                        expected = 3600  # 60分钟
                    elif granularity == 'D':
                        expected = 86400  # 1天
                    elif granularity == 'W':
                        expected = 604800  # 1周
                    elif granularity == 'M':
                        expected = 2592000  # 30天（近似）
                    else:
                        expected = 0
                    
                    if expected > 0:
                        print(f"时间间隔: {time_diff}秒 (期望: {expected}秒)")
                        if abs(time_diff - expected) < expected * 0.2:  # 允许20%误差
                            print(f"✓ 粒度正确")
                        else:
                            print(f"⚠️ 粒度可能不正确")
        elif response.status_code == 400:
            print(f"400 Bad Request - 可能不支持此粒度")
        elif response.status_code == 403:
            print(f"403 Forbidden - API密钥问题")
        else:
            print(f"其他错误: {response.status_code}")
            print(f"响应: {response.text[:200]}")
            
    except Exception as e:
        print(f"请求失败: {e}")

print("\n=== 结论 ===")
print("根据测试结果，我们可以知道Polygon支持哪些粒度")
print("然后调整我们的配置")