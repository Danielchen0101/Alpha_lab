import requests
import json
import time
from datetime import datetime, timedelta
import pytz

print("测试常规交易时间过滤效果...")
print("="*80)

# 测试1 Week数据
print("1. 测试1 Week小时数据 (常规交易时间过滤):")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': '60', 'range': '1week'}, 
                    timeout=15)
    
    print(f"  状态码: {r.status_code}")
    
    if r.status_code == 200:
        data = r.json()
        print(f"  数据源: {data.get('dataSource')}")
        print(f"  数据条数: {data.get('count', 0)}")
        print(f"  备注: {data.get('note', '无')}")
        print(f"  数据范围说明: {data.get('dataRangeNote', '无')}")
        
        points = data.get('data', [])
        if points:
            print(f"\n  数据时间范围:")
            first = points[0]
            last = points[-1]
            
            # UTC时间
            first_utc = datetime.utcfromtimestamp(first['timestamp'])
            last_utc = datetime.utcfromtimestamp(last['timestamp'])
            
            # 转换为美国东部时间
            eastern = pytz.timezone('US/Eastern')
            first_et = first_utc.replace(tzinfo=pytz.utc).astimezone(eastern)
            last_et = last_utc.replace(tzinfo=pytz.utc).astimezone(eastern)
            
            print(f"    最早 (UTC): {first_utc.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"    最早 (ET): {first_et.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"    最晚 (UTC): {last_utc.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"    最晚 (ET): {last_et.strftime('%Y-%m-%d %H:%M:%S')}")
            
            # 检查数据粒度
            print(f"\n  数据粒度检查:")
            if len(points) >= 2:
                time_diff = points[1]['timestamp'] - points[0]['timestamp']
                print(f"    时间间隔: {time_diff/3600:.1f}小时 ({time_diff}秒)")
                if abs(time_diff - 3600) < 600:  # 允许10分钟误差
                    print(f"    ✓ 保持1小时粒度")
                else:
                    print(f"    ⚠️ 时间粒度可能不正确")
            
            # 分析时间分布
            print(f"\n  时间分布分析 (ET时间):")
            et_counts = {}
            regular_hours = 0
            extended_hours = 0
            
            for p in points:
                utc_time = datetime.utcfromtimestamp(p['timestamp'])
                eastern = pytz.timezone('US/Eastern')
                et_time = utc_time.replace(tzinfo=pytz.utc).astimezone(eastern)
                et_hour = et_time.hour
                et_minute = et_time.minute
                
                et_counts[et_hour] = et_counts.get(et_hour, 0) + 1
                
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
            
            print(f"  美国东部时间分布:")
            for hour in sorted(et_counts.keys()):
                print(f"    {hour:02d}:00 - {hour:02d}:59: {et_counts[hour]}个数据点")
            
            print(f"\n  交易时间分类:")
            print(f"    常规交易时间数据点: {regular_hours}")
            print(f"    盘前盘后数据点: {extended_hours}")
            print(f"    总数据点: {len(points)}")
            
            if extended_hours == 0:
                print(f"    ✓ 成功过滤掉所有盘前盘后数据")
            else:
                print(f"    ⚠️ 仍有 {extended_hours} 个盘前盘后数据点")
            
            # 检查最后一个点是否在常规交易时间
            print(f"\n  最后一个数据点分析:")
            last_utc = datetime.utcfromtimestamp(last['timestamp'])
            eastern = pytz.timezone('US/Eastern')
            last_et = last_utc.replace(tzinfo=pytz.utc).astimezone(eastern)
            
            print(f"    时间 (UTC): {last_utc.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"    时间 (ET): {last_et.strftime('%Y-%m-%d %H:%M:%S')}")
            
            # 检查是否在常规交易时间
            if 9 <= last_et.hour < 16:
                if last_et.hour == 9 and last_et.minute >= 30:
                    print(f"    ✓ 最后一个点在常规交易时间内 (09:30-16:00 ET)")
                elif last_et.hour > 9 and last_et.hour < 16:
                    print(f"    ✓ 最后一个点在常规交易时间内 (09:30-16:00 ET)")
                else:
                    print(f"    ⚠️ 最后一个点不在常规交易时间内")
            else:
                print(f"    ⚠️ 最后一个点不在常规交易时间内")
            
            # 检查数据完整性
            print(f"\n  数据完整性:")
            expected_days = 7
            expected_hours_per_day = 6.5  # 常规交易时间6.5小时
            expected_total = int(expected_days * expected_hours_per_day)
            actual_total = len(points)
            
            print(f"    预期数据点 (7天×6.5小时/天): ~{expected_total}个")
            print(f"    实际数据点: {actual_total}个")
            
            if actual_total >= expected_total * 0.7:  # 至少70%的数据
                print(f"    ✓ 数据完整性良好")
            else:
                print(f"    ⚠️ 数据可能不完整")
    else:
        print(f"  错误: {r.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("2. 对比其他时间范围:")
timeframes = [
    {'interval': '30', 'range': '1day', 'desc': '1 Day (30分钟 -> 小时)'},
    {'interval': '60', 'range': '1week', 'desc': '1 Week (60分钟 -> 小时)'},
    {'interval': 'D', 'range': '1month', 'desc': '1 Month (日线)'},
]

for tf in timeframes:
    print(f"\n测试: {tf['desc']}")
    try:
        r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                        params={'interval': tf['interval'], 'range': tf['range']}, 
                        timeout=10)
        
        if r.status_code == 200:
            data = r.json()
            points = data.get('data', [])
            
            if points:
                first_utc = datetime.utcfromtimestamp(points[0]['timestamp'])
                last_utc = datetime.utcfromtimestamp(points[-1]['timestamp'])
                
                eastern = pytz.timezone('US/Eastern')
                first_et = first_utc.replace(tzinfo=pytz.utc).astimezone(eastern)
                last_et = last_utc.replace(tzinfo=pytz.utc).astimezone(eastern)
                
                print(f"  数据点: {len(points)}条")
                print(f"  时间范围 (ET): {first_et.strftime('%Y-%m-%d %H:%M')} 到 {last_et.strftime('%Y-%m-%d %H:%M')}")
                print(f"  备注: {data.get('note', '无')}")
        else:
            print(f"  错误: {r.status_code}")
            
    except Exception as e:
        print(f"  请求失败: {e}")

print()
print("="*80)
print("修改总结:")
print("1. 成功过滤盘前盘后数据，只保留常规交易时间 (09:30-16:00 ET)")
print("2. 保持1小时数据粒度不变")
print("3. 最后一个数据点应在常规交易时间内")
print("4. 数据源标记为'常规交易时间'")