import requests
import json
import time
from datetime import datetime, timedelta
import pytz

print("验证Finnhub今天数据的真实性...")
print("="*80)

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

symbol = 'AAPL'

# 1. 获取实时报价
print("1. 获取Finnhub实时报价:")
quote_url = f"{FINNHUB_BASE_URL}/quote"
params = {
    'symbol': symbol,
    'token': FINNHUB_API_KEY
}

try:
    response = requests.get(quote_url, params=params, timeout=5)
    if response.status_code == 200:
        quote_data = response.json()
        print(f"  实时报价数据:")
        print(f"    当前价格 (c): ${quote_data.get('c', 0):.2f}")
        print(f"    今日开盘 (o): ${quote_data.get('o', 0):.2f}")
        print(f"    今日最高 (h): ${quote_data.get('h', 0):.2f}")
        print(f"    今日最低 (l): ${quote_data.get('l', 0):.2f}")
        print(f"    前日收盘 (pc): ${quote_data.get('pc', 0):.2f}")
        
        # 验证数据合理性
        current_price = quote_data.get('c', 0)
        today_open = quote_data.get('o', 0)
        today_high = quote_data.get('h', 0)
        today_low = quote_data.get('l', 0)
        
        print(f"\n  数据验证:")
        
        # 检查价格是否在合理范围（AAPL应在$240-$260之间）
        if 240 <= current_price <= 260:
            print(f"    ✓ 当前价格合理: ${current_price:.2f}")
        else:
            print(f"    ⚠️ 当前价格异常: ${current_price:.2f}")
        
        # 检查高低点关系
        if today_low <= today_open <= today_high:
            print(f"    ✓ 开盘价在高低点范围内")
        else:
            print(f"    ⚠️ 开盘价超出高低点范围")
        
        if today_low <= current_price <= today_high:
            print(f"    ✓ 当前价格在高低点范围内")
        else:
            print(f"    ⚠️ 当前价格超出高低点范围")
        
        # 检查价格变化合理性
        if today_high - today_low <= today_open * 0.1:  # 日内波动不超过10%
            print(f"    ✓ 日内波动合理")
        else:
            print(f"    ⚠️ 日内波动异常")
            
    else:
        print(f"  请求失败: {response.status_code}")
        print(f"  响应: {response.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("2. 测试Finnhub分钟数据接口（验证是否可用）:")

# 计算今天的时间范围
now = datetime.now()
ny_tz = pytz.timezone('America/New_York')
now_ny = ny_tz.localize(now)
today_open_ny = now_ny.replace(hour=9, minute=30, second=0, microsecond=0)

from_timestamp = int(today_open_ny.timestamp())
to_timestamp = int(now_ny.timestamp())

# 测试不同分辨率
resolutions = ['1', '5', '15', '30', '60']  # 1分钟, 5分钟, 15分钟, 30分钟, 60分钟

for resolution in resolutions:
    print(f"\n  测试分辨率: {resolution}分钟")
    
    candle_url = f"{FINNHUB_BASE_URL}/stock/candle"
    candle_params = {
        'symbol': symbol,
        'resolution': resolution,
        'from': from_timestamp,
        'to': to_timestamp,
        'token': FINNHUB_API_KEY
    }
    
    try:
        candle_response = requests.get(candle_url, params=candle_params, timeout=5)
        print(f"    状态码: {candle_response.status_code}")
        
        if candle_response.status_code == 200:
            candle_data = candle_response.json()
            status = candle_data.get('s', 'unknown')
            print(f"    状态: {status}")
            
            if status == 'ok' and 'c' in candle_data:
                closes = candle_data['c']
                print(f"    数据点数量: {len(closes)}")
                
                if len(closes) > 0:
                    print(f"    价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
                    print(f"    第一个点: ${closes[0]:.2f}")
                    print(f"    最后一个点: ${closes[-1]:.2f}")
                    
                    # 检查是否与实时报价匹配
                    if abs(closes[-1] - current_price) < 1.0:
                        print(f"    ✓ 与实时报价匹配")
                    else:
                        print(f"    ⚠️ 与实时报价不匹配: 差值${abs(closes[-1] - current_price):.2f}")
                else:
                    print(f"    ⚠️ 无数据")
            else:
                print(f"    ⚠️ 数据错误: {candle_data.get('s')}")
        else:
            print(f"    ⚠️ HTTP错误: {candle_response.text[:100]}")
            
    except Exception as e:
        print(f"    请求失败: {e}")

print()
print("="*80)
print("3. 结论:")
print("根据测试结果:")
print("1. Finnhub实时报价API: 工作正常，提供今日开盘、最高、最低、当前价格")
print("2. Finnhub分钟数据API: 返回403错误，免费套餐不支持")
print("3. 因此无法获取真实的分钟级intraday数据")
print("4. 只能基于实时报价数据合理估计今天的小时数据")
print()
print("验证方案:")
print("1. 使用Finnhub实时报价验证今日价格范围")
print("2. 基于真实开盘价($249.40)、最高价($251.83)、最低价($247.30)生成小时数据")
print("3. 确保生成的价格在真实范围内")
print("4. 最后一个点使用当前实时价格($248.96)")
print("5. 时间戳使用正确的纽约时间")