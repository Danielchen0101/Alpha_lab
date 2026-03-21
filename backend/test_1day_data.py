import requests
from datetime import datetime

print("测试AAPL 1 Day历史数据...")
print("请求: GET /api/market/history/AAPL?interval=60&range=1day")

try:
    response = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                          params={'interval': '60', 'range': '1day'}, 
                          timeout=5)
    
    if response.status_code == 200:
        data = response.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"数据条数: {data.get('count')}")
        
        data_points = data.get('data', [])
        if data_points:
            print(f"\n所有数据点:")
            for i, point in enumerate(data_points):
                time_str = datetime.fromtimestamp(point['timestamp']).strftime('%m-%d %H:%M')
                print(f"  {i+1:2d}. 时间: {time_str}, C: {point['close']:.2f}")
            
            print(f"\n价格统计:")
            closes = [p['close'] for p in data_points]
            print(f"  最低价: {min(closes):.2f}")
            print(f"  最高价: {max(closes):.2f}")
            print(f"  平均价: {sum(closes)/len(closes):.2f}")
            
            # 检查价格范围
            if max(closes) < 100:
                print(f"\n⚠️ 发现低价数据! 范围: ${min(closes):.2f}-${max(closes):.2f}")
                print(f"  这可能是1 Day模拟数据的bug!")
        else:
            print("无数据返回")
    else:
        print(f"错误: {response.status_code}")
        
except Exception as e:
    print(f"请求失败: {e}")