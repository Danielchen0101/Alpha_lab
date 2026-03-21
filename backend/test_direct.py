import requests
import time

print("直接测试1 Week API，观察后端日志...")
print("="*80)

# 测试1 Week数据
url = 'http://127.0.0.1:8890/api/market/history/AAPL'
params = {'interval': '60', 'range': '1week'}

print(f"请求: {url}")
print(f"参数: {params}")
print()

try:
    start_time = time.time()
    response = requests.get(url, params=params, timeout=10)
    elapsed = time.time() - start_time
    
    print(f"响应时间: {elapsed:.2f}秒")
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"数据条数: {data.get('count')}")
        print(f"备注: {data.get('note')}")
        
        # 检查是否包含今天
        points = data.get('data', [])
        if points:
            # 找出今天的数据
            from datetime import datetime
            today_str = datetime.now().strftime('%Y-%m-%d')
            
            today_count = 0
            for p in points:
                dt = datetime.fromtimestamp(p['timestamp'])
                if dt.strftime('%Y-%m-%d') == today_str:
                    today_count += 1
            
            print(f"今天数据条数: {today_count}")
            
            if today_count > 0:
                print("✓ 包含今天数据")
            else:
                print("⚠️ 不包含今天数据")
    else:
        print(f"错误: {response.text[:200]}")
        
except Exception as e:
    print(f"请求失败: {e}")

print()
print("="*80)
print("现在检查后端是否成功调用了get_today_hourly_data_from_finnhub函数")
print("如果后端日志没有显示'尝试获取今天的小时数据'，说明函数没有被调用")