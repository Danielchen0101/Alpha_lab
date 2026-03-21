import requests
import json
from datetime import datetime

print("测试AAPL历史数据真实返回...")
print("请求: GET /api/market/history/AAPL?interval=D&range=1month")

try:
    response = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                          params={'interval': 'D', 'range': '1month'}, 
                          timeout=5)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"数据条数: {data.get('count')}")
        print(f"间隔: {data.get('interval')}")
        print(f"范围: {data.get('range')}")
        
        data_points = data.get('data', [])
        if data_points:
            print(f"\n前5个点:")
            for i, point in enumerate(data_points[:5]):
                time_str = datetime.fromtimestamp(point['timestamp']).strftime('%Y-%m-%d')
                print(f"  {i+1}. 时间: {time_str}, O: {point['open']:.2f}, H: {point['high']:.2f}, L: {point['low']:.2f}, C: {point['close']:.2f}")
            
            print(f"\n后5个点:")
            for i, point in enumerate(data_points[-5:]):
                time_str = datetime.fromtimestamp(point['timestamp']).strftime('%Y-%m-%d')
                print(f"  {i+1}. 时间: {time_str}, O: {point['open']:.2f}, H: {point['high']:.2f}, L: {point['low']:.2f}, C: {point['close']:.2f}")
            
            print(f"\n价格统计:")
            closes = [p['close'] for p in data_points]
            print(f"  最低价: {min(closes):.2f}")
            print(f"  最高价: {max(closes):.2f}")
            print(f"  平均价: {sum(closes)/len(closes):.2f}")
            print(f"  最后收盘价: {closes[-1]:.2f}")
            
            # 检查是否是模拟数据
            if data.get('dataSource') == 'Finnhub' and max(closes) < 150:
                print(f"\n⚠️ 警告: 数据标记为Finnhub但价格异常低!")
                print(f"  AAPL当前价格应在$240+，但图表显示在${min(closes):.2f}-${max(closes):.2f}范围")
                print(f"  这很可能是模拟数据!")
        else:
            print("无数据返回")
    else:
        print(f"错误: {response.text[:200]}")
        
except Exception as e:
    print(f"请求失败: {e}")

print("\n" + "="*60)
print("检查单股详情数据...")
try:
    response = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
    if response.status_code == 200:
        data = response.json()
        print(f"AAPL当前价格: ${data.get('price')}")
        print(f"数据源: {data.get('dataSource')}")
    else:
        print(f"错误: {response.status_code}")
except Exception as e:
    print(f"请求失败: {e}")