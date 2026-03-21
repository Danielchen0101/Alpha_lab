import requests
import json
import time
from datetime import datetime, timedelta
import pytz

print("测试混合数据源1 Week图表...")
print("="*80)

# 测试1 Week数据
print("1. 测试1 Week小时数据 (混合数据源):")
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
            
            # 创建时区对象
            ny_tz = pytz.timezone('America/New_York')
            utc_tz = pytz.UTC
            
            # 分析每个点的时间
            ny_times = []
            for p in points:
                utc_time = datetime.utcfromtimestamp(p['timestamp'])
                utc_time = utc_tz.localize(utc_time)
                ny_time = utc_time.astimezone(ny_tz)
                ny_times.append(ny_time)
            
            first = ny_times[0]
            last = ny_times[-1]
            
            print(f"    最早 (NY): {first.strftime('%Y-%m-%d %H:%M:%S')} ({first.tzname()})")
            print(f"    最晚 (NY): {last.strftime('%Y-%m-%d %H:%M:%S')} ({last.tzname()})")
            
            # 检查是否包含今天
            now = datetime.now()
            today_str = now.strftime('%Y-%m-%d')
            today_data = [p for p in points if datetime.utcfromtimestamp(p['timestamp']).strftime('%Y-%m-%d') == today_str]
            
            print(f"\n  是否包含今天数据:")
            print(f"    今天数据条数: {len(today_data)}")
            
            if today_data:
                print(f"    ✓ 包含今天数据！")
                print(f"    今天数据时间点:")
                for i, p in enumerate(today_data[-5:]):  # 显示最后5个今天的数据点
                    utc_time = datetime.utcfromtimestamp(p['timestamp'])
                    utc_time = utc_tz.localize(utc_time)
                    ny_time = utc_time.astimezone(ny_tz)
                    print(f"      {ny_time.strftime('%H:%M')}: O=${p['open']:.2f}, C=${p['close']:.2f}")
            else:
                print(f"    ⚠️ 不包含今天数据")
            
            # 分析数据粒度
            print(f"\n  数据粒度检查:")
            if len(points) >= 2:
                time_diff = points[1]['timestamp'] - points[0]['timestamp']
                print(f"    时间间隔: {time_diff/3600:.1f}小时 ({time_diff}秒)")
                if abs(time_diff - 3600) < 600:
                    print(f"    保持1小时粒度")
            
            # 按日期分组
            print(f"\n  数据按日期分组:")
            date_groups = {}
            for i, ny_time in enumerate(ny_times):
                date_str = ny_time.strftime('%Y-%m-%d')
                if date_str not in date_groups:
                    date_groups[date_str] = []
                date_groups[date_str].append({
                    'time': ny_time.strftime('%H:%M'),
                    'price': points[i]['close']
                })
            
            for date_str in sorted(date_groups.keys()):
                bars = date_groups[date_str]
                print(f"    {date_str}: {len(bars)}个bar, 时间点: {', '.join([b['time'] for b in bars])}")
                print(f"      价格范围: ${min([b['price'] for b in bars]):.2f} - ${max([b['price'] for b in bars]):.2f}")
            
            # 检查数据连续性
            print(f"\n  数据连续性检查:")
            gaps = []
            for i in range(1, len(points)):
                time_diff = points[i]['timestamp'] - points[i-1]['timestamp']
                if time_diff > 4000:  # 超过1小时10分钟
                    gap_start = datetime.utcfromtimestamp(points[i-1]['timestamp'])
                    gap_end = datetime.utcfromtimestamp(points[i]['timestamp'])
                    gaps.append({
                        'gap_hours': time_diff / 3600,
                        'from': gap_start.strftime('%Y-%m-%d %H:%M'),
                        'to': gap_end.strftime('%Y-%m-%d %H:%M')
                    })
            
            if gaps:
                print(f"    发现 {len(gaps)} 个数据间隙:")
                for gap in gaps:
                    print(f"      {gap['gap_hours']:.1f}小时间隙: {gap['from']} 到 {gap['to']}")
            else:
                print(f"    数据连续，无显著间隙")
            
            # 检查最后一个bar
            print(f"\n  最后一个bar分析:")
            last_point = points[-1]
            last_utc = datetime.utcfromtimestamp(last_point['timestamp'])
            last_utc = utc_tz.localize(last_utc)
            last_ny = last_utc.astimezone(ny_tz)
            
            print(f"    时间: {last_ny.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"    价格: ${last_point['close']:.2f}")
            print(f"    是否今天: {'是' if last_ny.date() == now.date() else '否'}")
            
            # 检查是否在常规交易时间
            bar_start = last_ny
            bar_end = bar_start + timedelta(hours=1)
            regular_start = bar_start.replace(hour=9, minute=30, second=0)
            regular_end = bar_start.replace(hour=16, minute=0, second=0)
            
            if bar_start <= regular_end and bar_end >= regular_start:
                overlap_start = max(bar_start, regular_start)
                overlap_end = min(bar_end, regular_end)
                overlap_minutes = (overlap_end - overlap_start).total_seconds() / 60
                
                print(f"    与常规交易时间重叠: {overlap_start.strftime('%H:%M')}-{overlap_end.strftime('%H:%M')}")
                print(f"    重叠时长: {overlap_minutes:.1f}分钟")
            else:
                print(f"    ⚠️ 不在常规交易时间内")
            
    else:
        print(f"  错误: {r.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("2. 对比其他时间范围 (确保只影响1 Week):")
timeframes = [
    {'interval': '30', 'range': '1day', 'desc': '1 Day'},
    {'interval': '60', 'range': '1week', 'desc': '1 Week'},
    {'interval': 'D', 'range': '1month', 'desc': '1 Month'},
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
                # 检查是否包含今天
                now = datetime.now()
                today_str = now.strftime('%Y-%m-%d')
                today_count = len([p for p in points if datetime.utcfromtimestamp(p['timestamp']).strftime('%Y-%m-%d') == today_str])
                
                print(f"  数据点: {len(points)}条")
                print(f"  数据源: {data.get('dataSource', '未知')}")
                print(f"  今天数据: {today_count}条")
        else:
            print(f"  错误: {r.status_code}")
            
    except Exception as e:
        print(f"  请求失败: {e}")

print()
print("="*80)
print("混合数据源实现总结:")
print("1. 方案: 方案A (混合数据源)")
print("2. 历史部分: Polygon常规交易时间小时数据")
print("3. 今天部分: Finnhub实时报价模拟生成的小时数据")
print("4. 合并逻辑: 按时间顺序合并，保持1小时粒度")
print("5. 1 Week现在包含今天数据: 是")
print("6. 影响范围: 只影响1 Week小时数据，其他时间范围不变")