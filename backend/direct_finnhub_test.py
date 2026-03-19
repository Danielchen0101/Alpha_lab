#!/usr/bin/env python3
"""
直接测试Finnhub API，不依赖Flask后端
"""

import requests
import time
from datetime import datetime, timedelta

# Finnhub配置
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

def test_finnhub_direct(timeframe_name, interval, range_param):
    """直接测试Finnhub API"""
    print(f"\n=== 直接测试Finnhub API: {timeframe_name} ===")
    print(f"前端参数: interval={interval}, range={range_param}")
    
    # 映射到Finnhub参数
    resolution_map = {
        '5min': '5',
        '1day': 'D'
    }
    
    # 计算时间范围
    end_time = int(time.time())
    
    range_days_map = {
        '1day': 1,
        '1week': 7,
        '1month': 30,
        '3month': 90,
        '1year': 365
    }
    
    days = range_days_map.get(range_param, 30)
    start_time = end_time - (days * 24 * 60 * 60)
    
    resolution = resolution_map.get(interval, 'D')
    
    print(f"Finnhub参数:")
    print(f"  - resolution: {resolution}")
    print(f"  - from: {start_time} ({datetime.fromtimestamp(start_time)})")
    print(f"  - to: {end_time} ({datetime.fromtimestamp(end_time)})")
    print(f"  - 时间范围: {days}天")
    
    # 调用Finnhub API
    url = f"{FINNHUB_BASE_URL}/stock/candle"
    params = {
        'symbol': 'AAPL',
        'resolution': resolution,
        'from': start_time,
        'to': end_time,
        'token': FINNHUB_API_KEY
    }
    
    print(f"\n发送请求到Finnhub...")
    try:
        response = requests.get(url, params=params, timeout=10)
        
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code != 200:
            print(f"错误: HTTP {response.status_code}")
            print(f"响应: {response.text[:200]}")
            return
        
        data = response.json()
        print(f"Finnhub响应状态: {data.get('s', 'unknown')}")
        
        if data.get('s') != 'ok':
            print(f"Finnhub错误: {data.get('s', 'no_data')}")
            return
        
        # 提取数据
        timestamps = data.get('t', [])
        opens = data.get('o', [])
        highs = data.get('h', [])
        lows = data.get('l', [])
        closes = data.get('c', [])
        volumes = data.get('v', [])
        
        data_count = len(timestamps)
        print(f"\n数据统计:")
        print(f"  - 数据条数: {data_count}")
        print(f"  - 有开盘价: {len(opens)}")
        print(f"  - 有最高价: {len(highs)}")
        print(f"  - 有最低价: {len(lows)}")
        print(f"  - 有收盘价: {len(closes)}")
        print(f"  - 有成交量: {len(volumes)}")
        
        if data_count > 0:
            # 第一条数据
            first_timestamp = timestamps[0]
            first_time = datetime.fromtimestamp(first_timestamp)
            print(f"\n第一条数据:")
            print(f"  - 时间: {first_time}")
            print(f"  - 开盘: {opens[0] if len(opens) > 0 else 'N/A'}")
            print(f"  - 最高: {highs[0] if len(highs) > 0 else 'N/A'}")
            print(f"  - 最低: {lows[0] if len(lows) > 0 else 'N/A'}")
            print(f"  - 收盘: {closes[0] if len(closes) > 0 else 'N/A'}")
            print(f"  - 成交量: {volumes[0] if len(volumes) > 0 else 'N/A'}")
            
            # 最后一条数据
            last_timestamp = timestamps[-1]
            last_time = datetime.fromtimestamp(last_timestamp)
            print(f"\n最后一条数据:")
            print(f"  - 时间: {last_time}")
            print(f"  - 开盘: {opens[-1] if len(opens) > 0 else 'N/A'}")
            print(f"  - 最高: {highs[-1] if len(highs) > 0 else 'N/A'}")
            print(f"  - 最低: {lows[-1] if len(lows) > 0 else 'N/A'}")
            print(f"  - 收盘: {closes[-1] if len(closes) > 0 else 'N/A'}")
            print(f"  - 成交量: {volumes[-1] if len(volumes) > 0 else 'N/A'}")
            
            # 时间跨度
            time_span = last_time - first_time
            print(f"\n时间跨度: {time_span.days}天 {time_span.seconds//3600}小时")
            
            # 数据频率分析
            if data_count > 1:
                time_diff = timestamps[1] - timestamps[0]
                if time_diff < 3600:  # 小于1小时
                    print(f"数据频率: 约{time_diff/60:.0f}分钟间隔")
                elif time_diff < 86400:  # 小于1天
                    print(f"数据频率: 约{time_diff/3600:.1f}小时间隔")
                else:
                    print(f"数据频率: 约{time_diff/86400:.1f}天间隔")
        
        else:
            print("警告: Finnhub返回空数据")
            
    except requests.exceptions.Timeout:
        print("错误: 请求超时")
    except requests.exceptions.RequestException as e:
        print(f"网络错误: {e}")
    except Exception as e:
        print(f"异常: {e}")

def main():
    print("=== 直接测试Finnhub API ===")
    print(f"API密钥: {FINNHUB_API_KEY[:10]}...")
    print(f"基础URL: {FINNHUB_BASE_URL}")
    
    # 测试所有timeframe
    test_finnhub_direct("1 Day", "5min", "1day")
    test_finnhub_direct("1 Week", "1day", "1week")
    test_finnhub_direct("1 Month", "1day", "1month")
    test_finnhub_direct("3 Months", "1day", "3month")
    test_finnhub_direct("1 Year", "1day", "1year")
    
    print("\n=== 测试完成 ===")

if __name__ == "__main__":
    main()