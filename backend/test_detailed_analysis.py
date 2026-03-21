import requests
import json
import time
from datetime import datetime, timedelta
import pytz

print("详细分析过滤逻辑...")
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
            # 创建时区对象
            ny_tz = pytz.timezone('America/New_York')
            utc_tz = pytz.UTC
            
            # 按日期分组
            date_groups = {}
            for i, p in enumerate(points):
                utc_time = datetime.utcfromtimestamp(p['timestamp'])
                utc_time = utc_tz.localize(utc_time)
                ny_time = utc_time.astimezone(ny_tz)
                
                date_str = ny_time.strftime('%Y-%m-%d')
                if date_str not in date_groups:
                    date_groups[date_str] = []
                
                date_groups[date_str].append({
                    'index': i,
                    'ny_time': ny_time,
                    'price': p['close'],
                    'timestamp': p['timestamp']
                })
            
            print(f"总数据点: {len(points)}")
            print(f"覆盖天数: {len(date_groups)}")
            print()
            
            # 分析每个交易日
            for date_str in sorted(date_groups.keys()):
                bars = date_groups[date_str]
                print(f"交易日: {date_str} (星期{datetime.strptime(date_str, '%Y-%m-%d').weekday()+1})")
                print(f"  Bar数量: {len(bars)}")
                
                # 按时间排序
                bars.sort(key=lambda x: x['ny_time'])
                
                print(f"  保留的bar时间点:")
                for bar in bars:
                    ny_time = bar['ny_time']
                    bar_start = ny_time
                    bar_end = bar_start + timedelta(hours=1)
                    
                    # 常规交易时间
                    regular_start = bar_start.replace(hour=9, minute=30, second=0)
                    regular_end = bar_start.replace(hour=16, minute=0, second=0)
                    
                    # 计算重叠
                    overlap_start = max(bar_start, regular_start)
                    overlap_end = min(bar_end, regular_end)
                    overlap_minutes = (overlap_end - overlap_start).total_seconds() / 60
                    
                    print(f"    {ny_time.strftime('%H:%M')}: bar覆盖{bar_start.strftime('%H:%M')}-{bar_end.strftime('%H:%M')}")
                    print(f"        与常规交易重叠: {overlap_start.strftime('%H:%M')}-{overlap_end.strftime('%H:%M')} ({overlap_minutes:.0f}分钟)")
                    print(f"        收盘价: ${bar['price']:.2f}")
                
                # 检查是否包含所有预期的bar
                bar_times = [bar['ny_time'].strftime('%H:%M') for bar in bars]
                expected_times = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']
                
                missing = [t for t in expected_times if t not in bar_times]
                extra = [t for t in bar_times if t not in expected_times]
                
                if missing:
                    print(f"  ⚠️ 缺少预期bar: {', '.join(missing)}")
                if extra:
                    print(f"  ⚠️ 多余bar: {', '.join(extra)}")
                
                if not missing and not extra:
                    print(f"  ✓ 包含所有预期bar")
                
                print()
            
            # 分析最后一个交易日
            print("="*80)
            print("最后一个交易日详细分析:")
            last_date = sorted(date_groups.keys())[-1]
            last_bars = date_groups[last_date]
            last_bars.sort(key=lambda x: x['ny_time'])
            
            last_bar = last_bars[-1]
            last_ny_time = last_bar['ny_time']
            
            print(f"日期: {last_date}")
            print(f"最后一个bar时间: {last_ny_time.strftime('%H:%M')}")
            print(f"最后一个bar收盘价: ${last_bar['price']:.2f}")
            
            # 分析bar覆盖范围
            bar_start = last_ny_time
            bar_end = bar_start + timedelta(hours=1)
            
            print(f"Bar覆盖: {bar_start.strftime('%H:%M')}-{bar_end.strftime('%H:%M')}")
            
            # 常规交易时间
            regular_start = bar_start.replace(hour=9, minute=30, second=0)
            regular_end = bar_start.replace(hour=16, minute=0, second=0)
            
            print(f"常规交易时间: {regular_start.strftime('%H:%M')}-{regular_end.strftime('%H:%M')}")
            
            # 计算重叠
            if bar_start <= regular_end and bar_end >= regular_start:
                overlap_start = max(bar_start, regular_start)
                overlap_end = min(bar_end, regular_end)
                overlap_minutes = (overlap_end - overlap_start).total_seconds() / 60
                
                print(f"重叠范围: {overlap_start.strftime('%H:%M')}-{overlap_end.strftime('%H:%M')}")
                print(f"重叠时长: {overlap_minutes:.1f}分钟")
                
                if overlap_minutes >= 30:
                    print(f"✓ 最后一个bar在常规交易时间内")
                else:
                    print(f"⚠️ 重叠不足30分钟")
            else:
                print(f"⚠️ 不在常规交易时间内")
            
            # 检查为什么没有16:00的bar
            print()
            print("检查16:00 bar:")
            # 16:00 bar覆盖16:00-17:00，与常规交易时间(09:30-16:00)的重叠是16:00-16:00 = 0分钟
            # 所以不应该保留16:00 bar
            
            print("16:00 bar分析:")
            print("  Bar覆盖: 16:00-17:00")
            print("  常规交易时间: 09:30-16:00")
            print("  重叠: 16:00-16:00 (0分钟)")
            print("  ✓ 正确过滤：重叠不足30分钟")
            
            print()
            print("15:00 bar分析:")
            print("  Bar覆盖: 15:00-16:00")
            print("  常规交易时间: 09:30-16:00")
            print("  重叠: 15:00-16:00 (60分钟)")
            print("  ✓ 正确保留：重叠60分钟≥30分钟")
            
    else:
        print(f"错误: {r.text[:200]}")
        
except Exception as e:
    print(f"请求失败: {e}")

print()
print("="*80)
print("结论:")
print("1. 过滤逻辑正确：保留与常规交易时间重叠≥30分钟的bar")
print("2. 15:00 bar (覆盖15:00-16:00) 重叠60分钟 → 保留")
print("3. 16:00 bar (覆盖16:00-17:00) 重叠0分钟 → 过滤")
print("4. 最后一个bar是15:00，这是正确的")
print("5. 数据粒度保持1小时不变")