import requests
import json
from datetime import datetime, timedelta

# 获取真实的3 Months数据
url = "http://127.0.0.1:8890/api/market/history/AAPL"
params = {
    'interval': 'D',
    'range': '3month'
}

print("获取真实的3 Months数据...")
try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        historical_data = data.get('data', [])
        
        print(f"\n=== 数据点分析 ===")
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
            
            # 检查关键日期是否存在
            print(f"\n=== 检查关键日期 ===")
            key_dates = [
                "2025-12-22",  # 第一个点
                "2026-01-05",  # 14天
                "2026-01-19",  # 28天
                "2026-02-02",  # 42天
                "2026-02-16",  # 56天
                "2026-03-02",  # 70天
                "2026-03-16",  # 84天
                "2026-03-20"   # 最后点
            ]
            
            for key_date in key_dates:
                exists = key_date in dates
                status = "OK" if exists else "MISSING"
                print(f"{status} {key_date}: {'存在' if exists else '缺失'}")
            
            # 显示所有日期（前20个和后20个）
            print(f"\n=== 前20个日期 ===")
            for i, date in enumerate(dates[:20]):
                print(f"  {i+1}. {date}")
            
            print(f"\n=== 后20个日期 ===")
            for i, date in enumerate(dates[-20:]):
                print(f"  {len(dates)-20+i+1}. {date}")
            
            # 检查日期连续性
            print(f"\n=== 日期连续性检查 ===")
            prev_date = None
            gaps = []
            for date_str in dates:
                current_date = datetime.strptime(date_str, '%Y-%m-%d')
                if prev_date:
                    gap = (current_date - prev_date).days
                    if gap > 3:  # 超过3天间隔（考虑周末）
                        gaps.append((prev_date.strftime('%Y-%m-%d'), date_str, gap))
                prev_date = current_date
            
            if gaps:
                print(f"发现 {len(gaps)} 个较大间隔:")
                for gap in gaps:
                    print(f"  {gap[0]} 到 {gap[1]}: {gap[2]} 天")
            else:
                print("日期连续性良好")
                
        else:
            print("没有数据返回")
    else:
        print(f"请求失败: {response.text}")
        
except Exception as e:
    print(f"测试失败: {e}")
    import traceback
    traceback.print_exc()