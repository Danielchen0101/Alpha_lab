import requests
import json
import time
from datetime import datetime, timedelta

print("直接测试Finnhub API响应...")
print("="*80)

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

# 测试历史数据API
print("\n测试Finnhub历史数据API...")

# 映射时间范围
range_to_seconds = {
    '1day': 'D',
    '1week': 'W',
    '1month': 'M',
    '3month': 'M',  # 可能需要多次请求
    '1year': 'M'    # 可能需要多次请求
}

# 测试1: 日线数据
print("\n1. 测试日线数据 (AAPL, 1个月):")
try:
    url = f"{FINNHUB_BASE_URL}/stock/candle"
    params = {
        'symbol': 'AAPL',
        'resolution': 'D',
        'from': int((datetime.now() - timedelta(days=30)).timestamp()),
        'to': int(datetime.now().timestamp()),
        'token': FINNHUB_API_KEY
    }
    
    print(f"  请求URL: {url}")
    print(f"  参数: {params}")
    
    response = requests.get(url, params=params, timeout=10)
    print(f"  状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"  响应: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
        
        if data.get('s') == 'ok':
            print(f"  成功! 数据条数: {len(data.get('c', []))}")
        elif data.get('s') == 'no_data':
            print(f"  无数据")
        else:
            print(f"  其他状态: {data.get('s')}")
    elif response.status_code == 403:
        print(f"  403 Forbidden - 可能免费版不支持历史数据API")
        print(f"  响应: {response.text[:200]}")
    else:
        print(f"  其他错误: {response.status_code}")
        print(f"  响应: {response.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

# 测试2: 分钟数据
print("\n2. 测试分钟数据 (AAPL, 1天):")
try:
    url = f"{FINNHUB_BASE_URL}/stock/candle"
    params = {
        'symbol': 'AAPL',
        'resolution': '60',  # 60分钟
        'from': int((datetime.now() - timedelta(days=1)).timestamp()),
        'to': int(datetime.now().timestamp()),
        'token': FINNHUB_API_KEY
    }
    
    print(f"  请求URL: {url}")
    print(f"  参数: {params}")
    
    response = requests.get(url, params=params, timeout=10)
    print(f"  状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"  响应: {json.dumps(data, indent=2, ensure_ascii=False)[:500]}")
        
        if data.get('s') == 'ok':
            print(f"  成功! 数据条数: {len(data.get('c', []))}")
        elif data.get('s') == 'no_data':
            print(f"  无数据")
        else:
            print(f"  其他状态: {data.get('s')}")
    elif response.status_code == 403:
        print(f"  403 Forbidden - 可能免费版不支持分钟数据")
        print(f"  响应: {response.text[:200]}")
    else:
        print(f"  其他错误: {response.status_code}")
        print(f"  响应: {response.text[:200]}")
        
except Exception as e:
    print(f"  请求失败: {e}")

# 测试3: 检查API套餐
print("\n3. 检查Finnhub免费版限制:")
print("  根据Finnhub文档:")
print("  - 免费版: 60次API调用/分钟")
print("  - 免费版: 支持实时报价")
print("  - 免费版: 可能不支持历史数据API或有限制")
print("  - 付费版: 支持完整历史数据")

print("\n" + "="*80)
print("Finnhub API测试总结:")
print("1. 检查是否返回403 Forbidden (免费版限制)")
print("2. 检查响应中的's'字段: 'ok', 'no_data', 或错误")
print("3. 确认免费版是否支持历史数据API")