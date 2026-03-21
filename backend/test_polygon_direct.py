import requests
import json
import time
from datetime import datetime, timedelta

print("直接测试Polygon API响应...")
print("="*80)

POLYGON_API_KEY = 'vx8LMXnMYMpBonwfXE2ssfqSo7WwcnlB'
POLYGON_BASE_URL = 'https://api.polygon.io'

# 测试不同的时间范围和粒度
test_cases = [
    {"symbol": "AAPL", "interval": "day", "range": "1day", "desc": "1 Day (日线)"},
    {"symbol": "AAPL", "interval": "day", "range": "1week", "desc": "1 Week (日线)"},
    {"symbol": "AAPL", "interval": "day", "range": "1month", "desc": "1 Month (日线)"},
    {"symbol": "AAPL", "interval": "day", "range": "3month", "desc": "3 Months (日线)"},
    {"symbol": "AAPL", "interval": "day", "range": "1year", "desc": "1 Year (日线)"},
    # 测试分钟数据（可能被限制）
    {"symbol": "AAPL", "interval": "minute", "range": "1day", "desc": "1 Day (分钟)"},
    {"symbol": "AAPL", "interval": "30", "range": "1day", "desc": "1 Day (30分钟)"},
    {"symbol": "AAPL", "interval": "60", "range": "1week", "desc": "1 Week (60分钟)"},
]

# 计算时间范围
now = datetime.now()
range_to_days = {
    '1day': 1,
    '1week': 7,
    '1month': 30,
    '3month': 90,
    '1year': 365
}

for test in test_cases:
    print(f"\n测试: {test['desc']}")
    print(f"  符号: {test['symbol']}, 粒度: {test['interval']}, 范围: {test['range']}")
    
    days_back = range_to_days.get(test['range'], 30)
    end_date = now.strftime('%Y-%m-%d')
    start_date = (now - timedelta(days=days_back)).strftime('%Y-%m-%d')
    
    url = f"{POLYGON_BASE_URL}/v2/aggs/ticker/{test['symbol'].upper()}/range/1/{test['interval']}/{start_date}/{end_date}"
    params = {
        'apiKey': POLYGON_API_KEY,
        'adjusted': 'true',
        'sort': 'asc'
    }
    
    print(f"  请求URL: {url}")
    print(f"  参数: {params}")
    
    try:
        start_time = time.time()
        response = requests.get(url, params=params, timeout=15)
        elapsed = time.time() - start_time
        
        print(f"  响应时间: {elapsed:.2f}秒")
        print(f"  状态码: {response.status_code}")
        
        # 详细分析响应
        if response.status_code == 200:
            data = response.json()
            print(f"  成功! 响应状态: {data.get('status', '未知')}")
            print(f"  结果数量: {data.get('resultsCount', 0)}")
            print(f"  查询计数: {data.get('queryCount', '未知')}")
            print(f"  结果字段: {list(data.keys())}")
            
            if 'results' in data and data['results']:
                results = data['results']
                print(f"  数据条数: {len(results)}")
                
                # 显示前几个数据点
                if len(results) > 0:
                    print(f"  第一个数据点:")
                    first = results[0]
                    time_str = datetime.fromtimestamp(first['t']/1000).strftime('%Y-%m-%d %H:%M:%S')
                    print(f"    时间: {time_str}")
                    print(f"    开盘: ${first['o']:.2f}")
                    print(f"    收盘: ${first['c']:.2f}")
                    print(f"    最高: ${first['h']:.2f}")
                    print(f"    最低: ${first['l']:.2f}")
                    print(f"    成交量: {first['v']}")
                    
                if len(results) > 1:
                    # 检查时间间隔
                    time_diff = (results[1]['t'] - results[0]['t']) / 1000  # 秒
                    print(f"  时间间隔: {time_diff}秒 ({time_diff/60:.1f}分钟, {time_diff/3600:.1f}小时)")
        
        elif response.status_code == 400:
            print(f"  400 Bad Request")
            try:
                error_data = response.json()
                print(f"  错误信息: {json.dumps(error_data, indent=2, ensure_ascii=False)}")
            except:
                print(f"  响应文本: {response.text[:500]}")
        
        elif response.status_code == 401:
            print(f"  401 Unauthorized - API密钥无效")
            print(f"  响应: {response.text[:200]}")
        
        elif response.status_code == 403:
            print(f"  403 Forbidden - 权限不足")
            print(f"  响应: {response.text[:200]}")
        
        elif response.status_code == 429:
            print(f"  429 Too Many Requests - 请求频率限制")
            try:
                error_data = response.json()
                print(f"  错误详情: {json.dumps(error_data, indent=2, ensure_ascii=False)}")
            except:
                print(f"  响应文本: {response.text[:500]}")
            
            # 检查是否有升级提示
            if "upgrade your subscription" in response.text.lower():
                print(f"  ⚠️ 需要升级套餐才能使用此功能")
        
        elif response.status_code == 500:
            print(f"  500 Internal Server Error - Polygon服务器错误")
            print(f"  响应: {response.text[:200]}")
        
        else:
            print(f"  其他状态码: {response.status_code}")
            print(f"  响应: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        print(f"  请求超时")
    except requests.exceptions.ConnectionError:
        print(f"  连接错误")
    except Exception as e:
        print(f"  请求异常: {e}")
    
    # 避免触发rate limit，添加延迟
    time.sleep(2)

print("\n" + "="*80)
print("Polygon API测试总结:")
print("1. 检查是否触发429 Too Many Requests (rate limit)")
print("2. 检查是否返回400 Bad Request (可能不支持某些粒度)")
print("3. 检查是否提示需要升级套餐")
print("4. 检查免费层限制: 每分钟5次请求")
print("5. 检查套餐权限: 免费层可能只支持日线数据")