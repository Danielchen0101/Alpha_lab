import requests
import json

# 测试1 Year数据请求
url = "http://127.0.0.1:8890/api/market/history/AAPL"
params = {
    'interval': 'D',
    'range': '1year'
}

print(f"测试1 Year数据请求...")
print(f"URL: {url}")
print(f"参数: {params}")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"数据源: {data.get('dataSource', 'N/A')}")
        print(f"数据数量: {len(data.get('data', []))}")
        
        # 检查数据日期范围
        historical_data = data.get('data', [])
        if historical_data:
            # 获取最早和最晚的时间戳
            timestamps = [item['timestamp'] for item in historical_data]
            from datetime import datetime
            earliest = datetime.fromtimestamp(min(timestamps))
            latest = datetime.fromtimestamp(max(timestamps))
            
            print(f"数据时间范围: {earliest.strftime('%Y-%m-%d')} 到 {latest.strftime('%Y-%m-%d')}")
            print(f"天数跨度: {(latest - earliest).days} 天")
            
            # 显示前5条数据
            print("\n前5条数据:")
            for i, item in enumerate(historical_data[:5]):
                dt = datetime.fromtimestamp(item['timestamp'])
                print(f"  {i+1}. {dt.strftime('%Y-%m-%d')}: O={item['open']:.2f}, H={item['high']:.2f}, L={item['low']:.2f}, C={item['close']:.2f}")
            
            # 检查是否是最近一年的数据
            from datetime import datetime, timedelta
            one_year_ago = datetime.now() - timedelta(days=365)
            if earliest > one_year_ago:
                print(f"✅ 数据范围正确: 从 {earliest.strftime('%Y-%m-%d')} 开始，在最近一年内")
            else:
                print(f"⚠️  数据范围可能太旧: 从 {earliest.strftime('%Y-%m-%d')} 开始，超过一年前")
        else:
            print("❌ 没有数据返回")
    else:
        print(f"❌ 请求失败: {response.text}")
        
except Exception as e:
    print(f"❌ 测试失败: {e}")