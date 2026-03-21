import requests
import time
import json

print("=== 直接测试Finnhub历史数据API ===")

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

# 测试不同的参数组合
test_cases = [
    {
        "desc": "AAPL 1个月日线数据",
        "symbol": "AAPL",
        "resolution": "D",
        "from": int(time.time()) - (30 * 24 * 60 * 60),  # 30天前
        "to": int(time.time())
    },
    {
        "desc": "AAPL 1年日线数据",
        "symbol": "AAPL",
        "resolution": "D",
        "from": int(time.time()) - (365 * 24 * 60 * 60),  # 1年前
        "to": int(time.time())
    },
    {
        "desc": "AAPL 1周60分钟数据",
        "symbol": "AAPL",
        "resolution": "60",
        "from": int(time.time()) - (7 * 24 * 60 * 60),  # 7天前
        "to": int(time.time())
    },
    {
        "desc": "测试免费套餐可能支持的参数",
        "symbol": "AAPL",
        "resolution": "D",
        "from": int(time.time()) - (5 * 24 * 60 * 60),  # 只请求5天
        "to": int(time.time())
    }
]

for test in test_cases:
    print(f"\n{'='*60}")
    print(f"测试: {test['desc']}")
    print(f"参数: symbol={test['symbol']}, resolution={test['resolution']}")
    print(f"时间范围: {test['from']} -> {test['to']}")
    print(f"日期: {time.strftime('%Y-%m-%d', time.localtime(test['from']))} 到 {time.strftime('%Y-%m-%d', time.localtime(test['to']))}")
    
    url = f"{FINNHUB_BASE_URL}/stock/candle"
    params = {
        'symbol': test['symbol'],
        'resolution': test['resolution'],
        'from': test['from'],
        'to': test['to'],
        'token': FINNHUB_API_KEY
    }
    
    print(f"\n请求URL: {url}")
    print(f"请求参数: {json.dumps(params, indent=2)}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        
        print(f"\n响应状态码: {response.status_code}")
        print(f"响应头:")
        for key, value in response.headers.items():
            if key.lower() in ['content-type', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']:
                print(f"  {key}: {value}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\n响应体:")
            print(json.dumps(data, indent=2))
            
            if data.get('s') == 'ok':
                timestamps = data.get('t', [])
                closes = data.get('c', [])
                print(f"\n成功! 获取到 {len(timestamps)} 条历史数据")
                if timestamps and closes:
                    print(f"时间范围: {time.strftime('%Y-%m-%d', time.localtime(timestamps[0]))} 到 {time.strftime('%Y-%m-%d', time.localtime(timestamps[-1]))}")
                    print(f"价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
                    print(f"最后收盘价: ${closes[-1]:.2f}")
            else:
                print(f"\nFinnhub返回错误状态: {data.get('s')}")
                print(f"错误信息: {data.get('err', '无')}")
                
        elif response.status_code == 403:
            print(f"\n403 Forbidden - API访问被拒绝")
            print("可能原因:")
            print("  1. API密钥无效")
            print("  2. 免费套餐不支持历史数据API")
            print("  3. 请求频率超限")
            print("  4. IP被限制")
            print(f"响应体: {response.text[:500]}")
            
        elif response.status_code == 429:
            print(f"\n429 Too Many Requests - 请求频率超限")
            print("响应体:", response.text[:500])
            
        else:
            print(f"\n其他错误: {response.status_code}")
            print(f"响应体: {response.text[:500]}")
            
    except Exception as e:
        print(f"\n请求异常: {e}")
        import traceback
        traceback.print_exc()

print(f"\n{'='*60}")
print("=== 结论 ===")
print("如果所有测试都返回403，说明:")
print("1. Finnhub免费套餐可能不支持历史数据API")
print("2. 需要升级到付费套餐")
print("3. 或寻找其他数据源")

print("\n=== 建议 ===")
print("1. 检查Finnhub账户套餐权限")
print("2. 查看API文档确认历史数据API的套餐限制")
print("3. 考虑使用其他免费数据源:")
print("   - Alpha Vantage (有免费套餐)")
print("   - Yahoo Finance (通过yfinance库)")
print("   - IEX Cloud (有免费额度)")
print("   - 本地缓存历史数据")