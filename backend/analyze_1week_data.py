"""
分析1 Week真实数据时间点
"""

import requests
from datetime import datetime, timedelta
import json

def analyze_1week_data():
    """分析1 Week真实数据时间点"""
    print("="*80)
    print("1 Week真实数据时间点分析")
    print("="*80)
    
    base_url = "http://localhost:8889"
    
    try:
        # 获取1 Week数据
        print("\n1. 获取后端1 Week原始数据...")
        response = requests.get(f"{base_url}/api/market/history/AAPL", 
                               params={'interval': '30min', 'range': '1week'},
                               timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"   原始数据条数: {data.get('count')}")
            
            if data.get('data') and len(data['data']) > 0:
                # 提取所有数据点
                all_points = data['data']
                
                print(f"\n2. 原始数据时间范围:")
                dates = [item['time'] for item in all_points]
                dates.sort()
                print(f"   最早日期: {dates[0]}")
                print(f"   最晚日期: {dates[-1]}")
                
                # 模拟前端过滤逻辑
                print(f"\n3. 模拟前端过滤逻辑:")
                
                # 计算目标起始日期：2026-03-13 09:30
                target_start = datetime(2026, 3, 13, 9, 30, 0)
                # 计算目标结束日期：今天16:00
                today = datetime.now()
                target_end = datetime(today.year, today.month, today.day, 16, 0, 0)
                
                print(f"   目标起始: {target_start.strftime('%Y-%m-%d %H:%M')}")
                print(f"   目标结束: {target_end.strftime('%Y-%m-%d %H:%M')}")
                
                # 过滤数据
                filtered_points = []
                for item in all_points:
                    item_time = datetime.fromisoformat(item['time'].replace('Z', '+00:00'))
                    if target_start <= item_time <= target_end:
                        filtered_points.append(item)
                
                print(f"   过滤后数据条数: {len(filtered_points)}")
                
                # 按日期分组
                print(f"\n4. 按日期分组分析 (过滤后):")
                date_groups = {}
                for item in filtered_points:
                    item_time = datetime.fromisoformat(item['time'].replace('Z', '+00:00'))
                    date_key = item_time.strftime('%Y-%m-%d')
                    if date_key not in date_groups:
                        date_groups[date_key] = []
                    date_groups[date_key].append({
                        'time': item_time.strftime('%H:%M'),
                        'close': item['close']
                    })
                
                # 特别分析3/13这一天
                print(f"\n5. 重点分析 2026-03-13:")
                if '2026-03-13' in date_groups:
                    march13_points = date_groups['2026-03-13']
                    print(f"   3/13数据点数量: {len(march13_points)}")
                    print(f"   时间点列表:")
                    for i, point in enumerate(march13_points):
                        print(f"     {i+1:2d}. {point['time']} - {point['close']}")
                    
                    # 检查是否有16:30
                    has_1630 = any(point['time'] == '16:30' for point in march13_points)
                    if has_1630:
                        print(f"   ⚠️ 发现16:30时间点")
                    else:
                        print(f"   ✅ 没有16:30时间点")
                    
                    # 检查关键时间点
                    key_times = ['09:30', '12:30', '15:30', '16:00']
                    for key_time in key_times:
                        has_key_time = any(point['time'] == key_time for point in march13_points)
                        if has_key_time:
                            print(f"   ✅ 有{key_time}时间点")
                        else:
                            print(f"   ⚠️ 缺少{key_time}时间点")
                else:
                    print(f"   ❌ 没有2026-03-13的数据")
                
                # 分析所有日期的数据点模式
                print(f"\n6. 所有交易日的数据点模式分析:")
                for date_key in sorted(date_groups.keys()):
                    points = date_groups[date_key]
                    times = [p['time'] for p in points]
                    
                    # 检查是否有16:30
                    has_1630 = '16:30' in times
                    has_1600 = '16:00' in times
                    
                    print(f"   {date_key}: {len(points)}个点", end="")
                    if has_1630:
                        print(f" (⚠️ 有16:30)", end="")
                    if has_1600:
                        print(f" (✅ 有16:00)", end="")
                    print()
                    
                    # 显示前几个时间点
                    if len(times) > 0:
                        print(f"     时间点: {', '.join(times[:5])}{'...' if len(times) > 5 else ''}")
                
                # 时区分析
                print(f"\n7. 时区分析:")
                print(f"   后端返回时间格式: {all_points[0]['time']}")
                print(f"   示例解析: {all_points[0]['time']} -> {datetime.fromisoformat(all_points[0]['time'].replace('Z', '+00:00')).strftime('%Y-%m-%d %H:%M')}")
                print(f"   当前时区: {datetime.now().astimezone().tzinfo}")
                print(f"   UTC偏移: {datetime.now().astimezone().utcoffset()}")
                
        else:
            print(f"   API请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"   分析失败: {e}")

def check_tooltip_format():
    """检查tooltip时间格式"""
    print("\n" + "="*80)
    print("检查tooltip时间格式问题")
    print("="*80)
    
    print("可能的问题原因:")
    print("  1. 时区转换: UTC时间转换为本地时间可能产生偏移")
    print("  2. 数据源问题: 后端返回的时间可能不是标准交易时间")
    print("  3. 前端格式化: tooltip格式化函数可能错误处理时间")
    print("  4. 数据过滤: 前端过滤可能保留了错误的时间点")
    
    print("\n典型场景:")
    print("  - 后端返回: 2026-03-13T15:30:00Z (UTC时间)")
    print("  - 前端解析: new Date('2026-03-13T15:30:00Z')")
    print("  - 本地显示: 可能显示为 2026-03-13 11:30 (如果时区是EST)")
    print("  - 或显示为: 2026-03-13 16:30 (如果时区转换错误)")
    
    print("\n建议检查:")
    print("  1. 前端formatXAxisTick函数如何处理1 Week时间")
    print("  2. tooltip格式化是否使用UTC方法")
    print("  3. 数据点是否真的包含16:30")

if __name__ == '__main__':
    analyze_1week_data()
    check_tooltip_format()