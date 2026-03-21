import requests
import json
import time
from datetime import datetime, timedelta
import pytz

print("测试修复后的今天数据...")
print("="*80)

# 测试1 Week数据
print("1. 测试1 Week小时数据 (修复后的今天数据):")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': '60', 'range': '1week'}, 
                    timeout=15)
    
    print(f"  状态码: {r.status_code}")
    
    if r.status_code == 200:
        data = r.json()
        print(f"  数据源: {data.get('dataSource')}")
        print(f"  数据条数: {data.get('count', 0)}")
        
        points = data.get('data', [])
        if points:
            # 创建时区对象
            ny_tz = pytz.timezone('America/New_York')
            utc_tz = pytz.UTC
            
            # 找出今天的数据
            now = datetime.now()
            today_str = now.strftime('%Y-%m-%d')
            
            today_points = []
            for p in points:
                utc_time = datetime.utcfromtimestamp(p['timestamp'])
                utc_time = utc_tz.localize(utc_time)
                ny_time = utc_time.astimezone(ny_tz)
                
                if ny_time.strftime('%Y-%m-%d') == today_str:
                    today_points.append({
                        'ny_time': ny_time,
                        'data': p
                    })
            
            print(f"\n  今天数据条数: {len(today_points)}")
            
            if today_points:
                print(f"  今天数据详情:")
                # 按时间排序
                today_points.sort(key=lambda x: x['ny_time'])
                
                for i, item in enumerate(today_points):
                    ny_time = item['ny_time']
                    p = item['data']
                    
                    print(f"    {i+1}. {ny_time.strftime('%H:%M')}:")
                    print(f"        Timestamp: {p['timestamp']}")
                    print(f"        O=${p['open']:.2f}, H=${p['high']:.2f}, L=${p['low']:.2f}, C=${p['close']:.2f}")
                    print(f"        Volume: {p['volume']:,}")
                    
                    # 特别检查09:30和10:30的数据
                    if ny_time.hour == 9 and ny_time.minute == 0:
                        print(f"        → 09:00 bar (覆盖09:00-10:00，包含09:30开盘)")
                        print(f"          检查: 开盘价应在$249.40附近")
                        if 248.0 <= p['open'] <= 251.0:
                            print(f"          ✓ 开盘价合理: ${p['open']:.2f}")
                        else:
                            print(f"          ⚠️ 开盘价可能不合理: ${p['open']:.2f}")
                    
                    if ny_time.hour == 10 and ny_time.minute == 0:
                        print(f"        → 10:00 bar (覆盖10:00-11:00，包含10:30)")
                        print(f"          检查: 价格应在$250附近")
                        if 249.0 <= p['close'] <= 252.0:
                            print(f"          ✓ 价格合理: ${p['close']:.2f}")
                        else:
                            print(f"          ⚠️ 价格可能不合理: ${p['close']:.2f}")
                
                # 分析今天数据的合理性
                print(f"\n  今天数据合理性分析:")
                today_closes = [item['data']['close'] for item in today_points]
                today_opens = [item['data']['open'] for item in today_points]
                today_highs = [item['data']['high'] for item in today_points]
                today_lows = [item['data']['low'] for item in today_points]
                
                min_close = min(today_closes)
                max_close = max(today_closes)
                avg_close = sum(today_closes) / len(today_closes)
                
                print(f"    收盘价范围: ${min_close:.2f} - ${max_close:.2f}")
                print(f"    平均收盘价: ${avg_close:.2f}")
                
                # 获取当前实时报价进行对比
                print(f"\n  与实时报价对比:")
                try:
                    quote_r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
                    if quote_r.status_code == 200:
                        quote_data = quote_r.json()
                        current_price = quote_data.get('price', 0)
                        today_high = quote_data.get('dayHigh', 0)
                        today_low = quote_data.get('dayLow', 0)
                        today_open = quote_data.get('open', 0)
                        
                        print(f"    当前实时价格: ${current_price:.2f}")
                        print(f"    今日开盘价: ${today_open:.2f}")
                        print(f"    今日最高价: ${today_high:.2f}")
                        print(f"    今日最低价: ${today_low:.2f}")
                        
                        # 检查最后一个数据点是否接近当前价格
                        last_close = today_points[-1]['data']['close']
                        price_diff = abs(last_close - current_price)
                        print(f"    最后一个数据点收盘价: ${last_close:.2f}")
                        print(f"    与当前价格差异: ${price_diff:.2f} ({price_diff/current_price*100:.2f}%)")
                        
                        if price_diff < 1.0:
                            print(f"    ✓ 最后一个点接近当前价格")
                        else:
                            print(f"    ⚠️ 最后一个点与当前价格差异较大")
                        
                        # 检查价格范围
                        if min(today_lows) >= today_low * 0.98 and max(today_highs) <= today_high * 1.02:
                            print(f"    ✓ 今天数据在今日真实价格范围内")
                        else:
                            print(f"    ⚠️ 今天数据可能超出今日真实范围")
                            
                    else:
                        print(f"    无法获取实时报价")
                        
                except Exception as e:
                    print(f"    获取实时报价失败: {e}")
            
            else:
                print(f"  ⚠️ 没有今天的数据")
            
            # 检查数据连续性
            print(f"\n  数据连续性检查 (今天与昨天连接处):")
            # 找出昨天最后一个点和今天第一个点
            yesterday_points = []
            today_points_all = []
            
            for p in points:
                utc_time = datetime.utcfromtimestamp(p['timestamp'])
                utc_time = utc_tz.localize(utc_time)
                ny_time = utc_time.astimezone(ny_tz)
                
                if ny_time.strftime('%Y-%m-%d') == today_str:
                    today_points_all.append((ny_time, p))
                else:
                    yesterday_points.append((ny_time, p))
            
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
                
                if gap_percent < 5:  # 5%以内的跳空是合理的
                    print(f"    ✓ 价格跳空在合理范围内")
                else:
                    print(f"    ⚠️ 价格跳空较大")
                
                # 检查时间间隔
                time_gap = (first_today[0] - last_yesterday[0]).total_seconds() / 3600
                print(f"    时间间隔: {time_gap:.1f}小时")
                
                if 15 <= time_gap <= 18:  # 收盘到第二天开盘的合理间隔
                    print(f"    ✓ 时间间隔合理 (隔夜)")
                else:
                    print(f"    ⚠️ 时间间隔异常")
            
    else:
        print(f"  错误: {r.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("2. 获取Finnhub原始报价数据验证:")
print("直接调用Finnhub API获取今日开盘、最高、最低价")

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

quote_url = f"{FINNHUB_BASE_URL}/quote"
params = {
    'symbol': 'AAPL',
    'token': FINNHUB_API_KEY
}

try:
    response = requests.get(quote_url, params=params, timeout=5)
    if response.status_code == 200:
        quote_data = response.json()
        print(f"  Finnhub原始报价数据:")
        print(f"    当前价格 (c): ${quote_data.get('c', 0):.2f}")
        print(f"    今日开盘 (o): ${quote_data.get('o', 0):.2f}")
        print(f"    今日最高 (h): ${quote_data.get('h', 0):.2f}")
        print(f"    今日最低 (l): ${quote_data.get('l', 0):.2f}")
        print(f"    前日收盘 (pc): ${quote_data.get('pc', 0):.2f}")
        
        # 计算今日涨跌幅
        if quote_data.get('pc', 0) > 0:
            change = quote_data.get('c', 0) - quote_data.get('pc', 0)
            change_percent = change / quote_data.get('pc', 0) * 100
            print(f"    今日涨跌: ${change:.2f} ({change_percent:.2f}%)")
    else:
        print(f"  Finnhub请求失败: {response.status_code}")
        
except Exception as e:
    print(f"  Finnhub请求失败: {e}")