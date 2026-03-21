import requests
import json
import time
from datetime import datetime, timedelta
import pytz

print("分析Polygon hourly bar的timestamp语义...")
print("="*80)

POLYGON_API_KEY = 'vx8LMXnMYMpBonwfXE2ssfqSo7WwcnlB'
POLYGON_BASE_URL = 'https://api.polygon.io'

# 获取昨天的小时数据
now = datetime.now()
yesterday = now - timedelta(days=1)
start_date = yesterday.strftime('%Y-%m-%d')
end_date = yesterday.strftime('%Y-%m-%d')

url = f"{POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/range/1/hour/{start_date}/{end_date}"
params = {
    'apiKey': POLYGON_API_KEY,
    'adjusted': 'true',
    'sort': 'asc'
}

print(f"请求URL: {url}")
print(f"日期: {start_date} (昨天)")
print()

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"查询状态: {data.get('status')}")
        print(f"结果数量: {data.get('resultsCount', 0)}")
        print(f"查询计数: {data.get('queryCount', '未知')}")
        
        if 'results' in data and data['results']:
            results = data['results']
            print(f"\n详细分析每个bar:")
            
            # 创建时区对象
            utc_tz = pytz.UTC
            ny_tz = pytz.timezone('America/New_York')
            
            for i, result in enumerate(results):
                # Polygon返回的时间戳是毫秒
                timestamp_ms = result['t']
                timestamp_seconds = timestamp_ms / 1000
                
                # 转换为datetime对象
                utc_time = datetime.utcfromtimestamp(timestamp_seconds)
                utc_time = utc_tz.localize(utc_time)
                
                # 转换为纽约时间
                ny_time = utc_time.astimezone(ny_tz)
                
                # 分析bar时间
                print(f"\nBar {i+1}:")
                print(f"  Timestamp (ms): {timestamp_ms}")
                print(f"  UTC时间: {utc_time.strftime('%Y-%m-%d %H:%M:%S')}")
                print(f"  NY时间: {ny_time.strftime('%Y-%m-%d %H:%M:%S')} ({ny_time.tzname()})")
                print(f"  价格: O=${result['o']:.2f}, H=${result['h']:.2f}, L=${result['l']:.2f}, C=${result['c']:.2f}")
                print(f"  交易量: {result['v']:,}")
                
                # 分析bar的时间语义
                # 如果timestamp是bar的开始时间，那么这个bar覆盖的时间段是:
                # [timestamp, timestamp + 1小时)
                bar_start = ny_time
                bar_end = bar_start + timedelta(hours=1)
                
                print(f"  如果timestamp是开始时间:")
                print(f"    Bar覆盖: {bar_start.strftime('%H:%M')} - {bar_end.strftime('%H:%M')}")
                
                # 检查是否覆盖常规交易时间
                regular_start = bar_start.replace(hour=9, minute=30, second=0)
                regular_end = bar_start.replace(hour=16, minute=0, second=0)
                
                # 判断bar是否与常规交易时间有重叠
                bar_overlaps_regular = (
                    (bar_start <= regular_end and bar_end >= regular_start)
                )
                
                if bar_overlaps_regular:
                    overlap_start = max(bar_start, regular_start)
                    overlap_end = min(bar_end, regular_end)
                    overlap_minutes = (overlap_end - overlap_start).total_seconds() / 60
                    
                    print(f"    与常规交易时间重叠: {overlap_start.strftime('%H:%M')}-{overlap_end.strftime('%H:%M')}")
                    print(f"    重叠时长: {overlap_minutes:.1f}分钟")
                    
                    if overlap_minutes >= 30:  # 至少重叠30分钟
                        print(f"    ✓ 应保留 (重叠≥30分钟)")
                    else:
                        print(f"    ⚠️ 重叠较少 ({overlap_minutes:.1f}分钟)")
                else:
                    print(f"    ✗ 不与常规交易时间重叠")
            
            # 分析时间分布
            print(f"\n{'='*80}")
            print("时间分布总结:")
            
            ny_times = []
            for result in results:
                timestamp_seconds = result['t'] / 1000
                utc_time = datetime.utcfromtimestamp(timestamp_seconds)
                utc_time = utc_tz.localize(utc_time)
                ny_time = utc_time.astimezone(ny_tz)
                ny_times.append(ny_time)
            
            print(f"总bar数: {len(ny_times)}")
            print(f"时间范围: {ny_times[0].strftime('%H:%M')} - {ny_times[-1].strftime('%H:%M')}")
            
            # 按小时分组
            hour_counts = {}
            for t in ny_times:
                hour = t.hour
                hour_counts[hour] = hour_counts.get(hour, 0) + 1
            
            print(f"\n每小时bar数量:")
            for hour in sorted(hour_counts.keys()):
                print(f"  {hour:02d}:00: {hour_counts[hour]}个bar")
            
            # 分析常规交易时间内的bar
            print(f"\n常规交易时间分析 (09:30-16:00 NY时间):")
            regular_bars = []
            for i, ny_time in enumerate(ny_times):
                hour = ny_time.hour
                minute = ny_time.minute
                
                # 如果timestamp是bar的开始时间
                bar_start = ny_time
                bar_end = bar_start + timedelta(hours=1)
                
                regular_start = bar_start.replace(hour=9, minute=30, second=0)
                regular_end = bar_start.replace(hour=16, minute=0, second=0)
                
                # 检查重叠
                if bar_start <= regular_end and bar_end >= regular_start:
                    overlap_start = max(bar_start, regular_start)
                    overlap_end = min(bar_end, regular_end)
                    overlap_minutes = (overlap_end - overlap_start).total_seconds() / 60
                    
                    if overlap_minutes >= 30:  # 至少30分钟重叠
                        regular_bars.append({
                            'index': i,
                            'time': ny_time,
                            'overlap_minutes': overlap_minutes,
                            'bar_range': f"{bar_start.strftime('%H:%M')}-{bar_end.strftime('%H:%M')}",
                            'overlap_range': f"{overlap_start.strftime('%H:%M')}-{overlap_end.strftime('%H:%M')}"
                        })
            
            print(f"符合条件的bar数: {len(regular_bars)}")
            for bar in regular_bars:
                print(f"  Bar {bar['index']+1}: {bar['time'].strftime('%H:%M')}")
                print(f"    Bar覆盖: {bar['bar_range']}")
                print(f"    与常规交易重叠: {bar['overlap_range']} ({bar['overlap_minutes']:.1f}分钟)")
        else:
            print(f"无数据返回")
    else:
        print(f"错误: {response.text[:200]}")
        
except Exception as e:
    print(f"请求失败: {e}")

print()
print("="*80)
print("Polygon hourly bar timestamp语义分析:")
print("根据Polygon API文档:")
print("1. timestamp是bar的开始时间 (Unix毫秒时间戳)")
print("2. bar覆盖的时间段: [timestamp, timestamp + 1小时)")
print("3. 例如: timestamp=09:00的bar覆盖09:00-10:00")
print()
print("常规交易时间过滤策略:")
print("1. 保留与常规交易时间(09:30-16:00)重叠≥30分钟的bar")
print("2. 这样会保留:")
print("   - 09:00 bar (覆盖09:00-10:00, 重叠30分钟: 09:30-10:00)")
print("   - 10:00-15:00 bar (完全在常规交易时间内)")
print("   - 16:00 bar (覆盖16:00-17:00, 不重叠)")
print("3. 最后一个常规交易bar应该是15:00 (覆盖15:00-16:00)")