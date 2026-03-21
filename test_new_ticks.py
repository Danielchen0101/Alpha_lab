import requests
import json
from datetime import datetime, timedelta

print("=== 测试新的get1WeekTicks逻辑 ===\n")

# 模拟chartData（基于实际API返回的数据）
def simulate_chart_data():
    # 获取实际API数据
    url = "http://localhost:8890/api/market/history/AAPL"
    params = {'range': '1week', 'interval': '30min'}
    
    response = requests.get(url, params=params, timeout=30)
    data = response.json()
    
    if 'data' not in data or not data['data']:
        return []
    
    # 模拟前端处理：反转、过滤、排序
    reversed_data = list(reversed(data['data']))
    
    # 过滤：从3/13 09:30开始，到今天16:00结束
    target_start = datetime(2026, 3, 13, 9, 30, 0)
    today = datetime.now()
    target_end = datetime(today.year, today.month, today.day, 16, 0, 0)
    
    filtered_data = []
    for item in reversed_data:
        time_str = item.get('time', '')
        if time_str:
            try:
                item_time = datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S')
                if target_start <= item_time <= target_end:
                    # 转换为前端格式
                    filtered_data.append({
                        'date': item_time.isoformat() + 'Z',  # ISO格式
                        'time': time_str,
                        'close': item.get('close', 0)
                    })
            except:
                continue
    
    # 按时间排序
    filtered_data.sort(key=lambda x: datetime.fromisoformat(x['date'].replace('Z', '')))
    
    # 检查是否缺少今天16:00
    today_1600 = datetime(today.year, today.month, today.day, 16, 0, 0)
    has_today_1600 = any(
        item.get('time') == today_1600.strftime('%Y-%m-%d %H:%M:%S')
        for item in filtered_data
    )
    
    if not has_today_1600:
        # 添加Finnhub补充的16:00
        filtered_data.append({
            'date': today_1600.isoformat() + 'Z',
            'time': today_1600.strftime('%Y-%m-%d %H:%M:%S'),
            'close': 250.50  # 模拟Finnhub价格
        })
        # 重新排序
        filtered_data.sort(key=lambda x: datetime.fromisoformat(x['date'].replace('Z', '')))
    
    return filtered_data

# 模拟新的get1WeekTicks函数逻辑
def simulate_get1WeekTicks(chart_data):
    ticks = []
    
    if not chart_data:
        return ticks
    
    print("1. 按日期分组数据:")
    data_by_date = {}
    
    for point in chart_data:
        date = datetime.fromisoformat(point['date'].replace('Z', ''))
        date_key = f"{date.year}-{date.month:02d}-{date.day:02d}"
        
        if date_key not in data_by_date:
            data_by_date[date_key] = []
        data_by_date[date_key].append(point)
    
    for date_key in sorted(data_by_date.keys()):
        print(f"   {date_key}: {len(data_by_date[date_key])}个点")
    
    print("\n2. 对每个交易日，查找3个关键时间点:")
    target_times = [
        {'hour': 9, 'minute': 30, 'label': '09:30'},
        {'hour': 12, 'minute': 0, 'label': '12:00'},
        {'hour': 16, 'minute': 0, 'label': '16:00'}
    ]
    
    sorted_dates = sorted(data_by_date.keys())
    
    for date_key in sorted_dates:
        day_data = data_by_date[date_key]
        date_parts = date_key.split('-')
        year = int(date_parts[0])
        month = int(date_parts[1]) - 1
        day = int(date_parts[2])
        
        print(f"\n   处理日期 {date_key}:")
        
        for target_time in target_times:
            # 创建目标时间
            target_date = datetime(year, month + 1, day, target_time['hour'], target_time['minute'], 0)
            
            # 查找匹配的数据点
            found_point = None
            
            # 首先尝试精确匹配
            for point in day_data:
                point_date = datetime.fromisoformat(point['date'].replace('Z', ''))
                if point_date == target_date:
                    found_point = point
                    break
            
            # 如果没有找到精确匹配，对于16:00，尝试查找补充的Finnhub数据
            if not found_point and target_time['hour'] == 16 and target_time['minute'] == 0:
                for point in day_data:
                    point_date = datetime.fromisoformat(point['date'].replace('Z', ''))
                    if point_date.hour == 16 and point_date.minute == 0:
                        found_point = point
                        print(f"      找到补充的16:00数据")
                        break
            
            # 如果还没有找到，对于16:00，退到当天最后一个点
            if not found_point and target_time['hour'] == 16 and target_time['minute'] == 0:
                if day_data:
                    # 按时间排序，取最后一个点
                    sorted_day_data = sorted(day_data, key=lambda x: datetime.fromisoformat(x['date'].replace('Z', '')))
                    found_point = sorted_day_data[-1]
                    last_time = datetime.fromisoformat(found_point['date'].replace('Z', ''))
                    print(f"      16:00未找到，使用当天最后一个点: {last_time.hour:02d}:{last_time.minute:02d}")
            
            # 如果找到点，添加到ticks
            if found_point:
                ticks.append(found_point['date'])
                point_time = datetime.fromisoformat(found_point['date'].replace('Z', ''))
                print(f"      添加 {target_time['label']}: {point_time.strftime('%Y-%m-%d %H:%M:%S')}")
            else:
                print(f"      未找到 {target_time['label']} 的数据点")
    
    return ticks

# 格式化ticks为前端显示格式
def format_ticks_for_display(ticks):
    formatted = []
    for tick in ticks:
        date = datetime.fromisoformat(tick.replace('Z', ''))
        formatted.append(f"{date.month}/{date.day} {date.hour:02d}:{date.minute:02d}")
    return formatted

# 运行测试
print("获取实际数据并模拟处理...")
chart_data = simulate_chart_data()

if chart_data:
    print(f"\n模拟chartData点数: {len(chart_data)}")
    print(f"第一个点: {chart_data[0]['time']}")
    print(f"最后一个点: {chart_data[-1]['time']}")
    
    print("\n" + "="*60)
    print("运行新的get1WeekTicks逻辑:")
    print("="*60)
    
    ticks = simulate_get1WeekTicks(chart_data)
    
    print(f"\n生成的ticks数量: {len(ticks)}")
    print("ticks列表 (ISO格式):")
    for i, tick in enumerate(ticks):
        date = datetime.fromisoformat(tick.replace('Z', ''))
        print(f"  {i+1}. {date.strftime('%Y-%m-%d %H:%M:%S')}")
    
    print("\n前端显示格式 (月/日 小时:分钟):")
    formatted_ticks = format_ticks_for_display(ticks)
    for i, formatted in enumerate(formatted_ticks):
        print(f"  {i+1}. {formatted}")
    
    # 验证规则
    print("\n" + "="*60)
    print("验证X轴规则:")
    print("="*60)
    
    # 检查每个交易日是否都有3个标签
    date_counts = {}
    for tick in ticks:
        date = datetime.fromisoformat(tick.replace('Z', ''))
        date_key = f"{date.month}/{date.day}"
        date_counts[date_key] = date_counts.get(date_key, 0) + 1
    
    print("\n每个交易日的标签数量:")
    all_correct = True
    for date_key, count in sorted(date_counts.items()):
        if count == 3:
            print(f"  {date_key}: {count}个标签 ✓")
        else:
            print(f"  {date_key}: {count}个标签 ✗ (应该是3个)")
            all_correct = False
    
    # 检查标签时间
    print("\n标签时间验证:")
    expected_times = ['09:30', '12:00', '16:00']
    for tick in ticks:
        date = datetime.fromisoformat(tick.replace('Z', ''))
        time_str = f"{date.hour:02d}:{date.minute:02d}"
        if time_str not in expected_times:
            print(f"  警告: {date.month}/{date.day} {time_str} 不是预期的09:30、12:00或16:00")
    
    if all_correct:
        print("\n✅ 所有交易日都有3个标签，符合规则")
    else:
        print("\n⚠️  部分交易日标签数量不正确")
    
    print("\n" + "="*60)
    print("最终X轴显示:")
    print("="*60)
    for i, formatted in enumerate(formatted_ticks):
        print(f"  {formatted}")
else:
    print("无法获取或处理数据")

print("\n=== 测试完成 ===")