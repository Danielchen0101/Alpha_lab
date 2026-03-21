import requests
import json
from datetime import datetime
import time

print("测试真实Finnhub数据后端...")
time.sleep(2)

test_cases = [
    {"interval": "60", "range": "1day", "desc": "1 Day数据"},
    {"interval": "60", "range": "1week", "desc": "1 Week数据"},
    {"interval": "D", "range": "1month", "desc": "1 Month数据"},
    {"interval": "D", "range": "3month", "desc": "3 Months数据"},
    {"interval": "D", "range": "1year", "desc": "1 Year数据"},
]

print("\n=== 测试AAPL历史数据 ===")

for test in test_cases:
    print(f"\n测试: {test['desc']}")
    print(f"参数: interval={test['interval']}, range={test['range']}")
    
    try:
        r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                        params={'interval': test['interval'], 'range': test['range']}, 
                        timeout=15)
        
        print(f"状态码: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            print(f"数据源: {data.get('dataSource')}")
            print(f"数据条数: {data.get('count')}")
            
            if 'error' in data:
                print(f"错误: {data.get('error')}")
            
            points = data.get('data', [])
            if points:
                closes = [p['close'] for p in points]
                print(f"价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
                print(f"最后收盘价: ${closes[-1]:.2f}")
                
                print(f"前5个点:")
                for i, p in enumerate(points[:5]):
                    date_str = datetime.fromtimestamp(p['timestamp']).strftime('%Y-%m-%d %H:%M')
                    print(f"  {i+1}. {date_str}: C=${p['close']:.2f}")
                
                print(f"后5个点:")
                for i, p in enumerate(points[-5:]):
                    date_str = datetime.fromtimestamp(p['timestamp']).strftime('%Y-%m-%d %H:%M')
                    print(f"  {len(points)-4+i}. {date_str}: C=${p['close']:.2f}")
                
                # 检查价格合理性
                if min(closes) < 50 or max(closes) > 500:
                    print(f"⚠️ 价格可能异常: AAPL应在$100-300范围")
            else:
                print("无数据返回")
        else:
            print(f"错误响应: {r.text[:200]}")
            
    except Exception as e:
        print(f"请求失败: {e}")

print("\n=== 测试单股详情 ===")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
    if r.status_code == 200:
        data = r.json()
        print(f"AAPL当前价格: ${data.get('price')}")
        print(f"数据源: {data.get('dataSource')}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n=== 测试其他股票 ===")
symbols = ["NVDA", "TSLA", "MSFT", "GOOGL"]
for symbol in symbols:
    try:
        r = requests.get(f'http://127.0.0.1:8890/api/market/history/{symbol}', 
                        params={'interval': 'D', 'range': '1month'}, 
                        timeout=10)
        if r.status_code == 200:
            data = r.json()
            points = data.get('data', [])
            if points:
                closes = [p['close'] for p in points]
                print(f"{symbol}: {len(points)}条数据, 价格范围: ${min(closes):.2f}-${max(closes):.2f}")
    except:
        print(f"{symbol}: 请求失败")

print("\n=== 总结 ===")
print("如果所有测试都返回真实数据且价格合理，说明:")
print("1. ✅ 后端已连接真实Finnhub API")
print("2. ✅ 历史数据接口工作正常")
print("3. ✅ 不再使用模拟数据")
print("4. 🔧 需要前端验证图表显示")