import requests
import json
import time
from datetime import datetime, timedelta
import pytz

print("检查时区和交易时间...")
print("="*80)

# 测试1 Week数据
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': '60', 'range': '1week'}, 
                    timeout=15)
    
    if r.status_code == 200:
        data = r.json()
        points = data.get('data', [])
        
        if points:
            print(f"数据点总数: {len(points)}")
            print(f"\n前5个数据点:")
            for i in range(min(5, len(points))):
                p = points[i]
                # UTC时间
                utc_time = datetime.utcfromtimestamp(p['timestamp'])
                # 转换为美国东部时间
                eastern = pytz.timezone('US/Eastern')
                et_time = utc_time.replace(tzinfo=pytz.utc).astimezone(eastern)
                
                print(f"  {i+1}. UTC: {utc_time.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"     ET: {et_time.strftime('%Y-%m-%d %H:%M:%S')} (美国东部时间)")
                print(f"     价格: O=${p['open']:.2f}, C=${p['close']:.2f}")
            
            print(f"\n最后5个数据点:")
            for i in range(max(0, len(points)-5), len(points)):
                p = points[i]
                utc_time = datetime.utcfromtimestamp(p['timestamp'])
                eastern = pytz.timezone('US/Eastern')
                et_time = utc_time.replace(tzinfo=pytz.utc).astimezone(eastern)
                
                print(f"  {i+1}. UTC: {utc_time.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"     ET: {et_time.strftime('%Y-%m-%d %H:%M:%S')} (美国东部时间)")
                print(f"     价格: O=${p['open']:.2f}, C=${p['close']:.2f}")
            
            # 分析时间分布
            print(f"\n时间分布分析:")
            time_counts = {}
            for p in points:
                utc_time = datetime.utcfromtimestamp(p['timestamp'])
                hour = utc_time.hour
                time_counts[hour] = time_counts.get(hour, 0) + 1
            
            print(f"  UTC小时分布:")
            for hour in sorted(time_counts.keys()):
                print(f"    {hour:02d}:00 - {hour:02d}:59: {time_counts[hour]}个数据点")
            
            # 转换为美国东部时间分析
            print(f"\n  美国东部时间分布:")
            et_counts = {}
            for p in points:
                utc_time = datetime.utcfromtimestamp(p['timestamp'])
                eastern = pytz.timezone('US/Eastern')
                et_time = utc_time.replace(tzinfo=pytz.utc).astimezone(eastern)
                et_hour = et_time.hour
                et_counts[et_hour] = et_counts.get(et_hour, 0) + 1
            
            for hour in sorted(et_counts.keys()):
                print(f"    {hour:02d}:00 - {hour:02d}:59: {et_counts[hour]}个数据点")
            
            # 检查是否在交易时间内
            print(f"\n  美股常规交易时间: 09:30 - 16:00 ET")
            regular_hours = 0
            extended_hours = 0
            
            for p in points:
                utc_time = datetime.utcfromtimestamp(p['timestamp'])
                eastern = pytz.timezone('US/Eastern')
                et_time = utc_time.replace(tzinfo=pytz.utc).astimezone(eastern)
                et_hour = et_time.hour
                et_minute = et_time.minute
                
                # 检查是否在常规交易时间
                if 9 <= et_hour < 16:
                    if et_hour == 9 and et_minute >= 30:
                        regular_hours += 1
                    elif et_hour > 9 and et_hour < 16:
                        regular_hours += 1
                    else:
                        extended_hours += 1
                else:
                    extended_hours += 1
            
            print(f"  常规交易时间数据点: {regular_hours}")
            print(f"  盘前盘后数据点: {extended_hours}")
            print(f"  总数据点: {len(points)}")
            
except Exception as e:
    print(f"请求失败: {e}")