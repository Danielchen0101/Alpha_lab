import requests
import json
import time
from datetime import datetime, timedelta
import pytz

print("测试准确的常规交易时间过滤...")
print("="*80)

# 测试1 Week数据
print("1. 测试1 Week小时数据:")
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
            
            # 分析数据粒度
            print(f"\n  数据粒度检查:")
            if len(points) >= 2:
                time_diff = points[1]['timestamp'] - points[0]['timestamp']
                print(f"    时间间隔: {time_diff/3600:.1f}小时 ({time_diff}秒)")
                if abs(time_diff - 3600) < 600:
                    print(f"    ✓ 保持1小时粒度")
            
            # 分析一个具体交易日的数据
            print(f"\n  分析一个具体交易日 (2026-03-18):")
            target_date = "2026-03-18"
            day_bars = []
            
            for i, ny_time in enumerate(ny_times):
                if ny_time.strftime('%Y-%m-%d') == target_date:
                    # 计算bar覆盖的时间段
                    bar_start = ny_time
                    bar_end = bar_start + timedelta(hours=1)
                    
                    # 常规交易时间
                    regular_start = bar_start.replace(hour=9, minute=30, second=0)
                    regular_end = bar_start.replace(hour=16, minute=0, second=0)
                    
                    # 计算重叠
                    overlap_start = max(bar_start, regular_start)
                    overlap_end = min(bar_end, regular_end)
                    overlap_minutes = (overlap_end - overlap_start).total_seconds() / 60
                    
                    day_bars.append({
                        'time': ny_time.strftime('%H:%M'),
                        'bar_range': f"{bar_start.strftime('%H:%M')}-{bar_end.strftime('%H:%M')}",
                        'overlap': f"{overlap_start.strftime('%H:%M')}-{overlap_end.strftime('%H:%M')}",
                        'overlap_minutes': overlap_minutes,
                        'price': points[i]['close']
                    })
            
            if day_bars:
                print(f"    该交易日保留的bar:")
                for bar in day_bars:
                    print(f"      {bar['time']}: bar覆盖{bar['bar_range']}, 重叠{bar['overlap']} ({bar['overlap_minutes']:.0f}分钟), 价格${bar['price']:.2f}")
                
                # 检查是否包含正确的bar
                bar_times = [bar['time'] for bar in day_bars]
                print(f"\n    保留的bar时间点: {', '.join(bar_times)}")
                
                # 应该包含的bar
                expected_bars = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']
                missing = [b for b in expected_bars if b not in bar_times]
                extra = [b for b in bar_times if b not in expected_bars]
                
                if not missing and not extra:
                    print(f"    ✓ 包含所有预期的常规交易时间bar")
                else:
                    if missing:
                        print(f"    ⚠️ 缺少bar: {', '.join(missing)}")
                    if extra:
                        print(f"    ⚠️ 多余bar: {', '.join(extra)}")
            
            # 分析最后一个bar
            print(f"\n  最后一个bar分析:")
            last_ny = ny_times[-1]
            last_bar_start = last_ny
            last_bar_end = last_bar_start + timedelta(hours=1)
            
            print(f"    Bar开始时间: {last_bar_start.strftime('%H:%M')}")
            print(f"    Bar覆盖: {last_bar_start.strftime('%H:%M')}-{last_bar_end.strftime('%H:%M')}")
            
            # 检查是否在常规交易时间内
            regular_start = last_bar_start.replace(hour=9, minute=30, second=0)
            regular_end = last_bar_start.replace(hour=16, minute=0, second=0)
            
            if last_bar_start <= regular_end and last_bar_end >= regular_start:
                overlap_start = max(last_bar_start, regular_start)
                overlap_end = min(last_bar_end, regular_end)
                overlap_minutes = (overlap_end - overlap_start).total_seconds() / 60
                
                print(f"    与常规交易时间重叠: {overlap_start.strftime('%H:%M')}-{overlap_end.strftime('%H:%M')}")
                print(f"    重叠时长: {overlap_minutes:.1f}分钟")
                
                if overlap_minutes >= 30:
                    print(f"    ✓ 最后一个bar在常规交易时间内")
                else:
                    print(f"    ⚠️ 最后一个bar与常规交易时间重叠不足30分钟")
            else:
                print(f"    ⚠️ 最后一个bar不在常规交易时间内")
            
            # 检查数据完整性
            print(f"\n  数据完整性分析:")
            
            # 按日期分组
            date_groups = {}
            for ny_time in ny_times:
                date_str = ny_time.strftime('%Y-%m-%d')
                if date_str not in date_groups:
                    date_groups[date_str] = []
                date_groups[date_str].append(ny_time.strftime('%H:%M'))
            
            print(f"    数据覆盖天数: {len(date_groups)}")
            
            for date_str, times in sorted(date_groups.items()):
                print(f"    {date_str}: {len(times)}个bar, 时间点: {', '.join(sorted(times))}")
            
            # 检查每个交易日的bar数量
            expected_bars_per_day = 7  # 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00
            complete_days = 0
            incomplete_days = 0
            
            for date_str, times in date_groups.items():
                if len(times) >= expected_bars_per_day * 0.8:  # 至少80%的bar
                    complete_days += 1
                else:
                    incomplete_days += 1
                    print(f"    ⚠️ {date_str} 数据不完整: 只有{len(times)}个bar")
            
            print(f"\n    完整交易日: {complete_days}天")
            print(f"    不完整交易日: {incomplete_days}天")
            
    else:
        print(f"  错误: {r.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("验证总结:")
print("1. 使用America/New_York时区进行准确转换")
print("2. 基于bar开始时间+1小时覆盖范围进行过滤")
print("3. 保留与常规交易时间(09:30-16:00)重叠≥30分钟的bar")
print("4. 预期保留bar: 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00")
print("5. 最后一个bar应该是15:00 (覆盖15:00-16:00)")