import requests
import json
from datetime import datetime, timedelta
import re

print("=== 根本原因分析 ===\n")

# 1. 获取实际数据
print("1. 获取后端实际数据...")
try:
    url = "http://localhost:8890/api/market/history/AAPL"
    params = {'range': '1week', 'interval': '30min'}
    
    response = requests.get(url, params=params, timeout=30)
    data = response.json()
    
    print(f"   状态码: {response.status_code}")
    print(f"   note: {data.get('note', 'N/A')}")
    print(f"   count: {data.get('count', 0)}")
    
    if 'data' in data and data['data']:
        # 模拟前端处理
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
                        filtered_data.append({
                            'date': item_time.isoformat() + 'Z',
                            'time': time_str,
                            'close': item.get('close', 0)
                        })
                except:
                    continue
        
        # 排序
        filtered_data.sort(key=lambda x: datetime.fromisoformat(x['date'].replace('Z', '')))
        
        # 补充今天16:00
        today_1600 = datetime(today.year, today.month, today.day, 16, 0, 0)
        has_today_1600 = any(
            item.get('time') == today_1600.strftime('%Y-%m-%d %H:%M:%S')
            for item in filtered_data
        )
        
        if not has_today_1600:
            filtered_data.append({
                'date': today_1600.isoformat() + 'Z',
                'time': today_1600.strftime('%Y-%m-%d %H:%M:%S'),
                'close': 250.50
            })
            filtered_data.sort(key=lambda x: datetime.fromisoformat(x['date'].replace('Z', '')))
        
        print(f"   前端chartData点数: {len(filtered_data)}")
        print(f"   第一个点: {filtered_data[0]['time']}")
        print(f"   最后一个点: {filtered_data[-1]['time']}")
        
        # 2. 模拟get1WeekTicks输出
        print("\n2. 模拟get1WeekTicks真实输出:")
        
        # 按日期分组
        data_by_date = {}
        for point in filtered_data:
            date = datetime.fromisoformat(point['date'].replace('Z', ''))
            date_key = f"{date.year}-{date.month:02d}-{date.day:02d}"
            if date_key not in data_by_date:
                data_by_date[date_key] = []
            data_by_date[date_key].append(point)
        
        # 生成ticks
        ticks = []
        target_times = [
            {'hour': 9, 'minute': 30, 'label': '09:30'},
            {'hour': 12, 'minute': 0, 'label': '12:00'},
            {'hour': 16, 'minute': 0, 'label': '16:00'}
        ]
        
        for date_key in sorted(data_by_date.keys()):
            day_data = data_by_date[date_key]
            date_parts = date_key.split('-')
            year = int(date_parts[0])
            month = int(date_parts[1])
            day = int(date_parts[2])
            
            for target_time in target_times:
                target_date = datetime(year, month, day, target_time['hour'], target_time['minute'], 0)
                
                # 查找匹配点
                found_point = None
                
                # 精确匹配
                for point in day_data:
                    point_date = datetime.fromisoformat(point['date'].replace('Z', ''))
                    if point_date == target_date:
                        found_point = point
                        break
                
                # 对于16:00的特殊处理
                if not found_point and target_time['hour'] == 16 and target_time['minute'] == 0:
                    # 查找补充的16:00
                    for point in day_data:
                        point_date = datetime.fromisoformat(point['date'].replace('Z', ''))
                        if point_date.hour == 16 and point_date.minute == 0:
                            found_point = point
                            break
                    
                    # 退到最后一个点
                    if not found_point and day_data:
                        sorted_day_data = sorted(day_data, key=lambda x: datetime.fromisoformat(x['date'].replace('Z', '')))
                        found_point = sorted_day_data[-1]
                
                if found_point:
                    ticks.append(found_point['date'])
        
        print(f"   get1WeekTicks返回ticks数量: {len(ticks)}")
        print("   ticks列表 (ISO格式):")
        for i, tick in enumerate(ticks):
            date = datetime.fromisoformat(tick.replace('Z', ''))
            print(f"     {i+1:2d}. {date.strftime('%Y-%m-%d %H:%M:%S')}")
        
        print("\n   ticks列表 (前端显示格式):")
        for i, tick in enumerate(ticks):
            date = datetime.fromisoformat(tick.replace('Z', ''))
            formatted = f"{date.month}/{date.day} {date.hour:02d}:{date.minute:02d}"
            print(f"     {i+1:2d}. {formatted}")
        
        # 3. 模拟formatXAxisTick输出
        print("\n3. 模拟formatXAxisTick对这些ticks的输出:")
        
        def simulate_formatXAxisTick(value, selectedTimeframe='1W'):
            if not value:
                return ''
            
            try:
                date = datetime.fromisoformat(value.replace('Z', ''))
                
                if selectedTimeframe == '1W':
                    month = date.month
                    day = date.day
                    hour = date.hour
                    minute = date.minute
                    
                    # 显示格式: M/D HH:MM
                    return f"{month}/{day} {hour:02d}:{minute:02d}"
                else:
                    return value
            except:
                return ''
        
        print("   formatXAxisTick输出:")
        for i, tick in enumerate(ticks):
            formatted = simulate_formatXAxisTick(tick, '1W')
            print(f"     {i+1:2d}. '{tick}' -> '{formatted}'")
        
        # 4. 分析XAxis配置
        print("\n4. XAxis实际配置分析:")
        print("   当前配置:")
        print("   - interval: 0 (强制显示所有ticks)")
        print("   - minTickGap: 0 (无最小间隙限制)")
        print("   - fontSize: 8 (1 Week时)")
        print("   - height: 60 (1 Week时)")
        print("   - padding: { left: 15, right: 15 }")
        
        # 5. 计算标签空间
        print("\n5. 标签空间计算:")
        chart_width = 1200  # 假设图表宽度
        ticks_count = len(ticks)
        avg_space_per_tick = chart_width / ticks_count
        print(f"   图表宽度: {chart_width}px")
        print(f"   ticks数量: {ticks_count}")
        print(f"   每个tick平均空间: {avg_space_per_tick:.1f}px")
        
        # 估算标签宽度
        label_widths = []
        for tick in ticks:
            date = datetime.fromisoformat(tick.replace('Z', ''))
            label = f"{date.month}/{date.day} {date.hour:02d}:{date.minute:02d}"
            # 估算：每个字符约6px，fontSize=8时
            width = len(label) * 6
            label_widths.append(width)
        
        avg_label_width = sum(label_widths) / len(label_widths)
        max_label_width = max(label_widths)
        print(f"   平均标签宽度: {avg_label_width:.1f}px")
        print(f"   最大标签宽度: {max_label_width:.1f}px")
        print(f"   空间对比: 平均空间({avg_space_per_tick:.1f}px) vs 平均标签宽度({avg_label_width:.1f}px)")
        
        if avg_space_per_tick < avg_label_width:
            print("   ⚠️ 空间不足: 标签宽度 > 可用空间")
        else:
            print("   ✅ 空间充足: 标签宽度 < 可用空间")
        
        # 6. 根本原因分析
        print("\n6. 根本原因分析:")
        
        # 检查是否有空字符串
        empty_labels = []
        for i, tick in enumerate(ticks):
            formatted = simulate_formatXAxisTick(tick, '1W')
            if not formatted or formatted.strip() == '':
                empty_labels.append(i+1)
        
        if empty_labels:
            print(f"   ❌ formatXAxisTick返回空字符串的ticks: {empty_labels}")
        else:
            print("   ✅ formatXAxisTick对所有ticks都返回有效字符串")
        
        # 检查时间点是否正确
        expected_times = ['09:30', '12:00', '15:30', '16:00']
        wrong_times = []
        for i, tick in enumerate(ticks):
            date = datetime.fromisoformat(tick.replace('Z', ''))
            time_str = f"{date.hour:02d}:{date.minute:02d}"
            if time_str not in expected_times:
                wrong_times.append((i+1, time_str))
        
        if wrong_times:
            print(f"   ⚠️ 有非预期的时间点: {wrong_times}")
        else:
            print("   ✅ 所有时间点都是预期的09:30、12:00、15:30或16:00")
        
except Exception as e:
    print(f"分析失败: {e}")

print("\n=== 分析完成 ===")