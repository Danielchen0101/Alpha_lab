import requests
import json

print("验证后端 history 接口数据")
print("=" * 60)

timeframes = [
    ('1week', '1day', '1week'),
    ('1month', '1day', '1month'),
    ('3month', '1day', '3month'),
    ('1year', '1day', '1year')
]

for label, interval, range_param in timeframes:
    print(f"\n{label.upper()} timeframe:")
    print(f"  请求: GET /api/market/history/AAPL?interval={interval}&range={range_param}")
    
    try:
        url = f'http://127.0.0.1:8889/api/market/history/AAPL?interval={interval}&range={range_param}'
        response = requests.get(url, timeout=15)
        
        print(f"  状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"  数组字段名: 'data'")
            print(f"  数据点数量: {data.get('count')}")
            print(f"  来源: {data.get('source')}")
            print(f"  消息: {data.get('message')}")
            
            if data.get('data') and len(data['data']) > 0:
                first_point = data['data'][0]
                print(f"  第一个数据点字段名: {list(first_point.keys())}")
                print(f"  示例数据点:")
                print(f"    timestamp: {first_point.get('timestamp')}")
                print(f"    time: {first_point.get('time')}")
                print(f"    open: {first_point.get('open')}")
                print(f"    high: {first_point.get('high')}")
                print(f"    low: {first_point.get('low')}")
                print(f"    close: {first_point.get('close')}")
                print(f"    volume: {first_point.get('volume')}")
                
                # 检查时间格式
                from datetime import datetime
                try:
                    dt = datetime.fromisoformat(first_point.get('time').replace('Z', '+00:00'))
                    print(f"    time 可解析为 datetime: {dt}")
                except:
                    print(f"    time 格式可能有问题: {first_point.get('time')}")
            else:
                print(f"  数据为空")
        else:
            print(f"  错误: {response.text[:200]}")
            
    except Exception as e:
        print(f"  异常: {e}")

print("\n" + "=" * 60)
print("完整 JSON 响应示例 (1month):")
try:
    response = requests.get('http://127.0.0.1:8889/api/market/history/AAPL?interval=1day&range=1month', timeout=10)
    data = response.json()
    
    # 只显示前2个数据点以节省空间
    if data.get('data'):
        sample_data = {
            'symbol': data.get('symbol'),
            'interval': data.get('interval'),
            'range': data.get('range'),
            'count': data.get('count'),
            'source': data.get('source'),
            'message': data.get('message'),
            'data': data['data'][:2]  # 只取前2个
        }
        print(json.dumps(sample_data, indent=2))
    else:
        print("无数据")
        
except Exception as e:
    print(f"错误: {e}")