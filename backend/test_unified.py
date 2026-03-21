import requests
import time

print("测试统一后的后端接口...")
time.sleep(2)

test_cases = [
    {
        "url": "http://127.0.0.1:8890/api/market/history/AAPL",
        "params": {"interval": "60", "range": "1day"},
        "desc": "1 Day数据"
    },
    {
        "url": "http://127.0.0.1:8890/api/market/history/AAPL",
        "params": {"interval": "60", "range": "1week"},
        "desc": "1 Week数据"
    },
    {
        "url": "http://127.0.0.1:8890/api/market/history/AAPL",
        "params": {"interval": "D", "range": "1month"},
        "desc": "1 Month数据"
    },
    {
        "url": "http://127.0.0.1:8890/api/market/stock/NVDA",
        "params": {},
        "desc": "NVDA单股详情"
    },
    {
        "url": "http://127.0.0.1:8890/api/market/stocks",
        "params": {},
        "desc": "股票列表"
    }
]

all_success = True
for test in test_cases:
    print(f"\n测试: {test['desc']}")
    try:
        r = requests.get(test['url'], params=test['params'], timeout=5)
        print(f"  状态码: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            if 'count' in data:
                print(f"  成功! 数据条数: {data.get('count')}")
            elif 'symbol' in data:
                print(f"  成功! 股票: {data.get('symbol')}")
                if data.get('symbol') == 'NVDA':
                    market_cap = data.get('marketCap')
                    print(f"  NVDA市值: {market_cap:,} (${market_cap/1_000_000_000_000:.2f}T)")
        else:
            print(f"  失败: {r.text[:100]}")
            all_success = False
    except Exception as e:
        print(f"  错误: {e}")
        all_success = False

print("\n" + "="*60)
if all_success:
    print("所有接口测试通过! ✓")
else:
    print("部分接口测试失败! ✗")
print("="*60)