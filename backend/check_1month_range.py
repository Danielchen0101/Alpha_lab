import requests
import json
from datetime import datetime, timedelta

# 测试1 Month数据范围
url = "http://127.0.0.1:8890/api/market/history/AAPL"
params = {
    'interval': 'D',
    'range': '1month'
}

print("检查1 Month数据范围...")
print(f"请求URL: {url}")
print(f"参数: {params}")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        historical_data = data.get('data', [])
        
        print(f"\n=== 1 Month数据点分析 ===")
        print(f"数据总数: {len(historical_data)}")
        
        if len(historical_data) > 0:
            # 提取所有日期
            dates = []
            for item in historical_data:
                time_str = item.get('time', '')
                if time_str:
                    dates.append(time_str)
            
            # 排序日期
            dates.sort()
            
            print(f"\n=== 日期范围 ===")
            print(f"最早日期: {dates[0]}")
            print(f"最晚日期: {dates[-1]}")
            
            # 计算日期跨度
            try:
                first_date = datetime.strptime(dates[0], '%Y-%m-%d')
                last_date = datetime.strptime(dates[-1], '%Y-%m-%d')
                days_diff = (last_date - first_date).days
                print(f"天数跨度: {days_diff} 天")
                
                # 检查是否是1个月（约30天）
                if days_diff < 20:
                    print(f"警告: 数据范围只有 {days_diff} 天，小于1个月（约30天）")
                elif days_diff > 40:
                    print(f"警告: 数据范围有 {days_diff} 天，大于1个月")
                else:
                    print(f"数据范围约 {days_diff} 天，接近1个月")
            except:
                pass
            
            # 检查今天日期
            today = datetime.now()
            print(f"\n=== 今天日期 ===")
            print(f"当前日期: {today.strftime('%Y-%m-%d')}")
            
            # 计算1个月前日期
            one_month_ago = today - timedelta(days=30)
            print(f"1个月前日期: {one_month_ago.strftime('%Y-%m-%d')}")
            
            # 显示所有日期
            print(f"\n=== 所有日期 ===")
            for i, date in enumerate(dates):
                print(f"  {i+1}. {date}")
                
        else:
            print(f"没有数据返回")
    else:
        print(f"请求失败: {response.text}")
        
except Exception as e:
    print(f"测试失败: {e}")
    import traceback
    traceback.print_exc()