import requests
import json
from datetime import datetime, timedelta

print("=== 最终XAxis强制显示验证 ===\n")

# 获取实际数据
url = "http://localhost:8890/api/market/history/AAPL"
params = {'range': '1week', 'interval': '30min'}

try:
    response = requests.get(url, params=params, timeout=30)
    data = response.json()
    
    print("1. 后端API数据:")
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
                'time': today_1600.strftime('%Y-%m-d %H:%M:%S'),
                'close': 250.50
            })
            filtered_data.sort(key=lambda x: datetime.fromisoformat(x['date'].replace('Z', '')))
        
        print(f"\n2. 前端chartData:")
        print(f"   数据点数: {len(filtered_data)}")
        print(f"   第一个点: {filtered_data[0]['time']}")
        print(f"   最后一个点: {filtered_data[-1]['time']}")
        
        # 模拟get1WeekTicks
        print("\n3. 1 Week实际传入的ticks数组:")
        
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
        
        print(f"   ticks数量: {len(ticks)}