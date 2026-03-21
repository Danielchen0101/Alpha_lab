import requests
import json
from datetime import datetime, timedelta

# 测试3 Months数据范围
url = "http://127.0.0.1:8890/api/market/history/AAPL"
params = {
    'interval': 'D',
    'range': '3month'
}

print("检查3 Months数据范围...")
print(f"请求URL: {url}")
print(f"参数: {params}")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        historical_data = data.get('data', [])
        
        print(f"\n=== 3 Months数据点分析 ===")
        print(f"数据总数: {len(historical_data)}")
        
        if len(historical_data) > 0:
            # 检查第一个和最后一个数据点
            first_point = historical_data[0]
            last_point = historical_data[-1]
            
            print(f"\n第一个数据点:")
            print(f"  time字段: {first_point.get('time', 'N/A')}")
            print(f"  timestamp: {first_point.get('timestamp', 'N/A')}")
            
            print(f"\n最后一个数据点:")
            print(f"  time字段: {last_point.get('time', 'N/A')}")
            print(f"  timestamp: {last_point.get('timestamp', 'N/A')}")
            
            # 检查所有time字段的日期
            times = [item.get('time', '') for item in historical_data]
            unique_times = sorted(set(times))
            
            print(f"\n=== 日期范围 ===")
            print(f"最早日期: {unique_times[0] if unique_times else 'N/A'}")
            print(f"最晚日期: {unique_times[-1] if unique_times else 'N/A'}")
            
            # 计算日期跨度
            if unique_times:
                try:
                    first_date = datetime.strptime(unique_times[0], '%Y-%m-%d')
                    last_date = datetime.strptime(unique_times[-1], '%Y-%m-%d')
                    days_diff = (last_date - first_date).days
                    print(f"天数跨度: {days_diff} 天")
                    
                    # 检查是否是3个月（约90天）
                    if days_diff < 60:
                        print(f"⚠️  警告: 数据范围只有 {days_diff} 天，小于3个月（约90天）")
                    elif days_diff > 120:
                        print(f"⚠️  警告: 数据范围有 {days_diff} 天，大于3个月")
                    else:
                        print(f"✅ 数据范围约 {days_diff} 天，接近3个月")
                except:
                    pass
            
            # 检查今天日期
            today = datetime.now()
            print(f"\n=== 今天日期 ===")
            print(f"当前日期: {today.strftime('%Y-%m-%d')}")
            
            # 计算3个月前日期
            three_months_ago = today - timedelta(days=90)
            print(f"3个月前日期: {three_months_ago.strftime('%Y-%m-%d')}")
            
            # 检查数据是否覆盖最近3个月
            if unique_times:
                try:
                    data_start = datetime.strptime(unique_times[0], '%Y-%m-%d')
                    data_end = datetime.strptime(unique_times[-1], '%Y-%m-%d')
                    
                    expected_start = three_months_ago
                    expected_end = today
                    
                    print(f"\n=== 3个月范围检查 ===")
                    print(f"数据开始: {data_start.strftime('%Y-%m-%d')}")
                    print(f"期望开始 (3个月前): {expected_start.strftime('%Y-%m-%d')}")
                    print(f"数据结束: {data_end.strftime('%Y-%m-%d')}")
                    print(f"期望结束 (今天): {expected_end.strftime('%Y-%m-%d')}")
                    
                    # 检查开始日期是否接近3个月前
                    start_diff = (data_start - expected_start).days
                    if abs(start_diff) > 15:
                        print(f"⚠️  开始日期偏差: {start_diff} 天")
                    else:
                        print(f"✅ 开始日期接近3个月前")
                    
                    # 检查结束日期是否接近今天
                    end_diff = (expected_end - data_end).days
                    if end_diff > 7:
                        print(f"⚠️  结束日期偏差: {end_diff} 天（数据比今天旧）")
                    else:
                        print(f"✅ 结束日期接近今天")
                        
                except:
                    pass
                
        else:
            print(f"没有数据返回")
    else:
        print(f"请求失败: {response.text}")
        
except Exception as e:
    print(f"测试失败: {e}")