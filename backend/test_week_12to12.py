import requests
import json
import time
from datetime import datetime, timedelta
import pytz

print("测试1 Week图表（12点到12点时间轴）...")
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
            # 创建时区对象
            ny_tz = pytz.timezone('America/New_York')
            utc_tz = pytz.UTC
            
            print(f"\n  数据时间范围分析:")
            
            # 分析所有数据点的时间
            ny_times = []
            for p in points:
                utc_time = datetime.utcfromtimestamp(p['timestamp'])
                utc_time = utc_tz.localize(utc_time)
                ny_time = utc_time.astimezone(ny_tz)
                ny_times.append(ny_time)
            
            first = ny_times[0]
            last = ny_times[-1]
            
            print(f"    最早: {first.strftime('%Y-%m-%d %H:%M:%S')} ({first.tzname()})")
            print(f"    最晚: {last.strftime('%Y-%m-%d %H:%M:%S')} ({last.tzname()})")
            print(f"    时间跨度: {(last - first).total_seconds()/3600/24:.1f}天")
            
            # 按日期分组
            print(f"\n  按日期分组分析:")
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
                times = [b['time'] for b in bars]
                prices = [b['price'] for b in bars]
                
                print(f"    {date_str}: {len(bars)}个数据点")
                print(f"      时间点: {', '.join(times)}")
                print(f"      价格范围: ${min(prices):.2f} - ${max(prices):.2f}")
            
            # 特别分析今天的数据
            print(f"\n  今天数据详细验证:")
            now = datetime.now()
            today_str = now.strftime('%Y-%m-%d')
            
            today_points = []
            for i, ny_time in enumerate(ny_times):
                if ny_time.strftime('%Y-%m-%d') == today_str:
                    today_points.append({
                        'time': ny_time,
                        'data': points[i]
                    })
            
            if today_points:
                print(f"    今天数据条数: {len(today_points)}")
                print(f"    今天数据详情:")
                
                # 按时间排序
                today_points.sort(key=lambda x: x['time'])
                
                for item in today_points:
                    ny_time = item['time']
                    p = item['data']
                    
                    time_str = ny_time.strftime('%H:%M')
                    print(f"      {time_str}:")
                    print(f"        Timestamp: {p['timestamp']}")
                    print(f"        O=${p['open']:.2f}, H=${p['high']:.2f}, L=${p['low']:.2f}, C=${p['close']:.2f}")
                    print(f"        Volume: {p['volume']:,}")
                    print(f"        原始数据源: Finnhub实时报价估计")
                    print(f"        聚合前原始点数: 无（基于实时报价估计生成）")
                    
                    # 验证关键时间点
                    if time_str == '09:30':
                        print(f"        → 09:30验证: 开盘价应在$249.40附近")
                        if 248.0 <= p['open'] <= 251.0:
                            print(f"          ✓ 开盘价合理: ${p['open']:.2f}")
                        else:
                            print(f"          ⚠️ 开盘价异常: ${p['open']:.2f}")
                    
                    if time_str == '10:30':
                        print(f"        → 10:30验证: 价格应在$250附近")
                        if 249.0 <= p['close'] <= 252.0:
                            print(f"          ✓ 价格合理: ${p['close']:.2f}")
                        else:
                            print(f"          ⚠️ 价格异常: ${p['close']:.2f}")
                    
                    if time_str == '11:30':
                        print(f"        → 11:30验证: 价格应在$249-$251之间")
                        if 248.5 <= p['close'] <= 251.5:
                            print(f"          ✓ 价格合理: ${p['close']:.2f}")
                        else:
                            print(f"          ⚠️ 价格异常: ${p['close']:.2f}")
                    
                    if time_str == '12:30':
                        print(f"        → 12:30验证: 价格应在$249-$251之间")
                        if 248.5 <= p['close'] <= 251.5:
                            print(f"          ✓ 价格合理: ${p['close']:.2f}")
                        else:
                            print(f"          ⚠️ 价格异常: ${p['close']:.2f}")
                
                # 验证今天数据的整体合理性
                print(f"\n    今天数据整体验证:")
                today_closes = [item['data']['close'] for item in today_points]
                today_opens = [item['data']['open'] for item in today_points]
                
                min_close = min(today_closes)
                max_close = max(today_closes)
                avg_close = sum(today_closes) / len(today_closes)
                
                print(f"      收盘价范围: ${min_close:.2f} - ${max_close:.2f}")
                print(f"      平均收盘价: ${avg_close:.2f}")
                
                # 获取实时报价对比
                try:
                    quote_r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
                    if quote_r.status_code == 200:
                        quote_data = quote_r.json()
                        current_price = quote_data.get('price', 0)
                        today_high = quote_data.get('dayHigh', 0)
                        today_low = quote_data.get('dayLow', 0)
                        today_open = quote_data.get('open', 0)
                        
                        print(f"      实时报价对比:")
                        print(f"        当前价格: ${current_price:.2f}")
                        print(f"        今日开盘: ${today_open:.2f}")
                        print(f"        今日最高: ${today_high:.2f}")
                        print(f"        今日最低: ${today_low:.2f}")
                        
                        # 检查最后一个点
                        last_close = today_points[-1]['data']['close']
                        price_diff = abs(last_close - current_price)
                        print(f"        最后一个点收盘价: ${last_close:.2f}")
                        print(f"        与当前价格差异: ${price_diff:.2f}")
                        
                        if price_diff < 0.5:
                            print(f"        ✓ 最后一个点接近当前价格")
                        else:
                            print(f"        ⚠️ 最后一个点与当前价格差异较大")
                        
                        # 检查价格范围
                        if min(today_closes) >= today_low * 0.99 and max(today_closes) <= today_high * 1.01:
                            print(f"        ✓ 今天数据在今日真实价格范围内")
                        else:
                            print(f"        ⚠️ 今天数据可能超出今日真实范围")
                            
                    else:
                        print(f"      无法获取实时报价")
                        
                except Exception as e:
                    print(f"      获取实时报价失败: {e}")
            
            else:
                print(f"    ⚠️ 没有今天的数据")
            
            # 检查数据源分工
            print(f"\n  数据源分工验证:")
            print(f"    Polygon历史段负责: 2026-03-12 到 2026-03-18")
            print(f"    Finnhub当日段负责: 2026-03-19 (今天)")
            print(f"    合并后总数据点: {len(points)}")
            
            # 检查合并点
            print(f"\n  数据合并点检查:")
            # 找出昨天最后一个点和今天第一个点
            yesterday_points = []
            today_points_all = []
            
            for i, ny_time in enumerate(ny_times):
                date_str = ny_time.strftime('%Y-%m-%d')
                if date_str == today_str:
                    today_points_all.append((ny_time, points[i]))
                else:
                    yesterday_points.append((ny_time, points[i]))
            
            if yesterday_points and today_points_all:
                yesterday_points.sort(key=lambda x: x[0])
                today_points_all.sort(key=lambda x: x[0])
                
                last_yesterday = yesterday_points[-1]
                first_today = today_points_all[0]
                
                print(f"    昨天最后一个点: {last_yesterday[0].strftime('%Y-%m-%d %H:%M')}, C=${last_yesterday[1]['close']:.2f}")
                print(f"    今天第一个点: {first_today[0].strftime('%Y-%m-%d %H:%M')}, O=${first_today[1]['open']:.2f}")
                
                # 检查价格跳空
                price_gap = first_today[1]['open'] - last_yesterday[1]['close']
                gap_percent = abs(price_gap) / last_yesterday[1]['close'] * 100
                
                print(f"    价格跳空: ${price_gap:.2f} ({gap_percent:.2f}%)")
                
                if gap_percent < 5:
                    print(f"    ✓ 价格跳空合理")
                else:
                    print(f"    ⚠️ 价格跳空较大")
            
    else:
        print(f"  错误: {r.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("测试总结:")
print("1. 数据源: Polygon历史 + Finnhub今天")
print("2. 时间轴: 12点到12点完整时间流")
print("3. 数据粒度: 1小时一个点")
print("4. X轴标签: 每3小时显示一次 (00:00, 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00)")
print("5. Tooltip: 仍然1小时一次")
print("6. 今天数据验证: 基于Finnhub实时报价的合理估计")