import requests
import json
from datetime import datetime, timedelta
import time

print("测试Twelve Data API...")
print("="*80)

TWELVEDATA_API_KEY = '8b847a1ef2aa47a68d3f992bd0275f0c'
TWELVEDATA_BASE_URL = 'https://api.twelvedata.com'

symbol = 'AAPL'

# 1. 测试时间序列数据（图表数据）
print("1. 测试时间序列数据（图表数据）:")

# 测试不同时间范围
test_cases = [
    {'interval': '1h', 'range': '1week', 'outputsize': 168},  # 1周小时数据
    {'interval': '30min', 'range': '1day', 'outputsize': 48},  # 1天30分钟数据
    {'interval': '1day', 'range': '1month', 'outputsize': 30},  # 1月日线数据
    {'interval': '1day', 'range': '3month', 'outputsize': 90},  # 3月日线数据
    {'interval': '1day', 'range': '1year', 'outputsize': 365},  # 1年日线数据
]

for test in test_cases:
    print(f"\n  测试: {test['range']} - {test['interval']}")
    
    url = f"{TWELVEDATA_BASE_URL}/time_series"
    params = {
        'symbol': symbol,
        'interval': test['interval'],
        'outputsize': test['outputsize'],
        'apikey': TWELVEDATA_API_KEY,
        'format': 'JSON'
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"    状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # 检查数据结构
            if 'values' in data:
                values = data['values']
                print(f"    数据条数: {len(values)}")
                
                if len(values) > 0:
                    # 显示第一条和最后一条数据
                    first = values[-1]  # Twelve Data返回的是倒序，最新的在最后
                    last = values[0]    # 最旧的在最前
                    
                    print(f"    第一条数据 (最旧):")
                    print(f"      时间: {first.get('datetime')}")
                    print(f"      开盘: {first.get('open')}")
                    print(f"      最高: {first.get('high')}")
                    print(f"      最低: {first.get('low')}")
                    print(f"      收盘: {first.get('close')}")
                    print(f"      成交量: {first.get('volume')}")
                    
                    print(f"    最后一条数据 (最新):")
                    print(f"      时间: {last.get('datetime')}")
                    print(f"      开盘: {last.get('open')}")
                    print(f"      最高: {last.get('high')}")
                    print(f"      最低: {last.get('low')}")
                    print(f"      收盘: {last.get('close')}")
                    print(f"      成交量: {last.get('volume')}")
                    
                    # 检查字段是否完整
                    required_fields = ['datetime', 'open', 'high', 'low', 'close', 'volume']
                    missing_fields = [field for field in required_fields if field not in first]
                    
                    if missing_fields:
                        print(f"    ⚠️ 缺少字段: {missing_fields}")
                    else:
                        print(f"    ✓ 字段完整")
                        
                    # 检查时间范围
                    if len(values) > 1:
                        first_time = first['datetime']
                        last_time = last['datetime']
                        print(f"    时间范围: {first_time} 到 {last_time}")
                        
                else:
                    print(f"    ⚠️ 无数据")
            else:
                print(f"    ⚠️ 数据结构异常: {list(data.keys())}")
                if 'code' in data:
                    print(f"    错误代码: {data.get('code')}")
                if 'message' in data:
                    print(f"    错误信息: {data.get('message')}")
        else:
            print(f"    ⚠️ HTTP错误: {response.text[:200]}")
            
    except Exception as e:
        print(f"    请求失败: {e}")

print()
print("="*80)
print("2. 测试实时报价（对比Finnhub）:")

# 测试实时报价
quote_url = f"{TWELVEDATA_BASE_URL}/quote"
quote_params = {
    'symbol': symbol,
    'apikey': TWELVEDATA_API_KEY
}

try:
    response = requests.get(quote_url, params=quote_params, timeout=5)
    print(f"  状态码: {response.status_code}")
    
    if response.status_code == 200:
        quote_data = response.json()
        print(f"  实时报价数据:")
        print(f"    当前价格: {quote_data.get('close')}")
        print(f"    今日开盘: {quote_data.get('open')}")
        print(f"    今日最高: {quote_data.get('high')}")
        print(f"    今日最低: {quote_data.get('low')}")
        print(f"    前日收盘: {quote_data.get('previous_close')}")
        print(f"    涨跌幅: {quote_data.get('percent_change')}%")
        print(f"    涨跌额: {quote_data.get('change')}")
        print(f"    成交量: {quote_data.get('volume')}")
        
        # 检查字段
        available_fields = [k for k, v in quote_data.items() if v is not None]
        print(f"    可用字段: {available_fields}")
    else:
        print(f"  错误: {response.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("3. 测试公司信息:")

# 测试公司信息
profile_url = f"{TWELVEDATA_BASE_URL}/profile"
profile_params = {
    'symbol': symbol,
    'apikey': TWELVEDATA_API_KEY
}

try:
    response = requests.get(profile_url, params=profile_params, timeout=5)
    print(f"  状态码: {response.status_code}")
    
    if response.status_code == 200:
        profile_data = response.json()
        print(f"  公司信息:")
        print(f"    公司名称: {profile_data.get('name')}")
        print(f"    行业: {profile_data.get('industry')}")
        print(f"    市值: {profile_data.get('market_capitalization')}")
        print(f"    交易所: {profile_data.get('exchange')}")
        print(f"    货币: {profile_data.get('currency')}")
        print(f"    国家: {profile_data.get('country')}")
    else:
        print(f"  错误: {response.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

print()
print("="*80)
print("总结:")
print("1. Twelve Data支持:")
print("   - 时间序列数据 (time_series): 用于图表")
print("   - 实时报价 (quote): 用于当前价格")
print("   - 公司信息 (profile): 用于公司详情")
print("2. 数据格式: JSON，字段与Polygon类似但需要转换")
print("3. 时间序列数据是倒序排列（最新的在最后）")
print("4. 需要统一转换格式以兼容现有前端")