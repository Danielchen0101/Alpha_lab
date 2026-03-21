import requests
import json
import time
from datetime import datetime, timedelta

print("测试修复后的1 Week数据...")
print("="*80)

# 测试1 Week数据
print("1. 测试1 Week小时数据 (interval=60, range=1week):")
try:
    # 第一次请求 - 应该获取新数据
    print("第一次请求 (应该获取新数据):")
    start_time = time.time()
    r1 = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                     params={'interval': '60', 'range': '1week'}, 
                     timeout=15)
    elapsed1 = time.time() - start_time
    
    print(f"  响应时间: {elapsed1:.2f}秒")
    print(f"  状态码: {r1.status_code}")
    
    if r1.status_code == 200:
        data1 = r1.json()
        print(f"  数据源: {data1.get('dataSource')}")
        print(f"  数据条数: {data1.get('count', 0)}")
        
        points = data1.get('data', [])
        if points:
            print(f"  数据时间范围:")
            first = points[0]
            last = points[-1]
            
            first_time = datetime.fromtimestamp(first['timestamp']).strftime('%Y-%m-%d %H:%M:%S')
            last_time = datetime.fromtimestamp(last['timestamp']).strftime('%Y-%m-%d %H:%M:%S')
            
            print(f"    最早: {first_time}")
            print(f"    最晚: {last_time}")
            
            # 检查是否包含今天的数据
            now = datetime.now()
            today_data = [p for p in points if datetime.fromtimestamp(p['timestamp']).date() == now.date()]
            print(f"    今天数据条数: {len(today_data)}")
            
            if today_data:
                print(f"    今天数据时间点 (最后5个):")
                for p in today_data[-5:]:
                    time_str = datetime.fromtimestamp(p['timestamp']).strftime('%H:%M')
                    print(f"      {time_str}: O=${p['open']:.2f}, H=${p['high']:.2f}, L=${p['low']:.2f}, C=${p['close']:.2f}")
            else:
                print(f"    ⚠️ 没有今天的数据!")
                
            # 检查数据完整性
            print(f"\n  数据完整性检查:")
            print(f"    总数据点: {len(points)}")
            
            # 检查时间间隔
            if len(points) >= 2:
                time_diffs = []
                for i in range(1, min(10, len(points))):
                    diff = points[i]['timestamp'] - points[i-1]['timestamp']
                    time_diffs.append(diff)
                
                avg_diff = sum(time_diffs) / len(time_diffs)
                print(f"    平均时间间隔: {avg_diff/3600:.1f}小时")
                
                # 检查是否有缺失的时间段
                expected_hours = 7 * 24  # 一周最多168小时
                actual_hours = len(points)
                coverage = actual_hours / expected_hours * 100
                print(f"    时间覆盖率: {coverage:.1f}%")
    else:
        print(f"  错误: {r1.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("2. 测试缓存行为 (立即第二次请求):")
try:
    # 第二次请求 - 应该使用缓存（但1 Week小时数据缓存只有60秒）
    print("第二次请求 (应该使用缓存，但可能强制刷新):")
    start_time = time.time()
    r2 = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                     params={'interval': '60', 'range': '1week'}, 
                     timeout=15)
    elapsed2 = time.time() - start_time
    
    print(f"  响应时间: {elapsed2:.2f}秒 (应该比第一次快)")
    print(f"  状态码: {r2.status_code}")
    
    if elapsed2 < 0.1:
        print(f"  ✓ 可能来自缓存 (响应时间: {elapsed2:.3f}秒)")
    else:
        print(f"  ⚠️ 可能重新请求 (响应时间: {elapsed2:.3f}秒)")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("3. 测试其他时间范围对比:")
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
                first = datetime.fromtimestamp(points[0]['timestamp']).strftime('%Y-%m-%d %H:%M')
                last = datetime.fromtimestamp(points[-1]['timestamp']).strftime('%Y-%m-%d %H:%M')
                
                today_count = len([p for p in points if datetime.fromtimestamp(p['timestamp']).date() == datetime.now().date()])
                
                print(f"  数据点: {len(points)}条")
                print(f"  时间范围: {first} 到 {last}")
                print(f"  今天数据: {today_count}条")
        else:
            print(f"  错误: {r.status_code}")
            
    except Exception as e:
        print(f"  请求失败: {e}")

print()
print("="*80)
print("修复总结:")
print("1. 修改了缓存逻辑: 小时数据缓存60秒，日线数据缓存300秒")
print("2. 1 Week小时数据如果缓存超过60秒会强制刷新")
print("3. 确保时间范围包含今天的数据")
print("4. 修复了时区处理问题")