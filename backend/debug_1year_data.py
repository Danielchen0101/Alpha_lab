import requests
import json
from datetime import datetime

# 测试1 Year数据
url = "http://127.0.0.1:8890/api/market/history/AAPL"
params = {
    'interval': 'D',
    'range': '1year'
}

print("测试1 Year数据...")
print(f"请求URL: {url}")
print(f"参数: {params}")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        historical_data = data.get('data', [])
        
        print(f"\n=== 1 Year数据点分析 ===")
        print(f"数据总数: {len(historical_data)}")
        
        if len(historical_data) > 0:
            # 显示所有数据点的日期
            print(f"\n所有数据点的日期:")
            for i, item in enumerate(historical_data):
                if 'time' in item:
                    print(f"  {i+1}. time: {item['time']}, close: {item.get('close', 'N/A')}")
                else:
                    print(f"  {i+1}. timestamp: {item.get('timestamp', 'N/A')}, close: {item.get('close', 'N/A')}")
            
            # 检查日期范围
            if 'time' in historical_data[0]:
                dates = [item['time'] for item in historical_data]
                print(f"\n=== 日期范围 ===")
                print(f"最早日期: {dates[0]}")
                print(f"最晚日期: {dates[-1]}")
                print(f"数据点数量: {len(dates)}")
            
            # 检查数据点是否足够
            expected_points = 252  # 一年约252个交易日
            actual_points = len(historical_data)
            print(f"\n=== 数据点数量检查 ===")
            print(f"预期数据点 (交易日): {expected_points}")
            print(f"实际数据点: {actual_points}")
            
            if actual_points < expected_points * 0.5:
                print(f"⚠️  警告: 数据点太少! 只有预期的 {actual_points/expected_points*100:.1f}%")
            elif actual_points >= expected_points:
                print(f"✅ 数据点数量正常")
            else:
                print(f"⚠️  数据点偏少: 只有预期的 {actual_points/expected_points*100:.1f}%")
            
        else:
            print(f"❌ 没有数据返回")
    else:
        print(f"❌ 请求失败: {response.text}")
        
except Exception as e:
    print(f"❌ 测试失败: {e}")