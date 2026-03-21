import requests
import json
from datetime import datetime
import time

print("测试混合后端...")
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
                        timeout=10)
        
        print(f"状态码: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            print(f"数据源: {data.get('dataSource')}")
            print(f"数据条数: {data.get('count')}")
            print(f"是否模拟: {data.get('isSimulated', '未知')}")
            print(f"有实时报价: {data.get('hasRealQuote', '未知')}")
            print(f"备注: {data.get('note', '无')}")
            
            points = data.get('data', [])
            if points:
                closes = [p['close'] for p in points]
                print(f"价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
                print(f"最后收盘价: ${closes[-1]:.2f}")
                
                # 检查价格合理性
                if 100 <= min(closes) <= 300 and 100 <= max(closes) <= 300:
                    print("✓ 价格在合理范围 ($100-300)")
                else:
                    print("⚠️ 价格可能异常")
                
                print(f"前5个点:")
                for i, p in enumerate(points[:5]):
                    date_str = datetime.fromtimestamp(p['timestamp']).strftime('%Y-%m-%d')
                    print(f"  {i+1}. {date_str}: O=${p['open']:.2f}, H=${p['high']:.2f}, L=${p['low']:.2f}, C=${p['close']:.2f}")
                
                print(f"后5个点:")
                for i, p in enumerate(points[-5:]):
                    date_str = datetime.fromtimestamp(p['timestamp']).strftime('%Y-%m-%d')
                    print(f"  {len(points)-4+i}. {date_str}: O=${p['open']:.2f}, H=${p['high']:.2f}, L=${p['low']:.2f}, C=${p['close']:.2f}")
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
        print(f"涨跌: ${data.get('change')}")
        print(f"涨跌幅: {data.get('changePercent')}%")
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
                print(f"{symbol}: {len(points)}条数据, 价格范围: ${min(closes):.2f}-${max(closes):.2f}, 数据源: {data.get('dataSource')}")
    except Exception as e:
        print(f"{symbol}: 请求失败 - {e}")

print("\n=== 一致性检查 ===")
print("检查页面价格和图表最后收盘价是否一致:")
try:
    # 获取单股详情
    stock_r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
    if stock_r.status_code == 200:
        stock_data = stock_r.json()
        current_price = stock_data.get('price')
        print(f"页面当前价格: ${current_price}")
    
    # 获取历史数据
    history_r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                           params={'interval': 'D', 'range': '1month'}, 
                           timeout=10)
    if history_r.status_code == 200:
        history_data = history_r.json()
        points = history_data.get('data', [])
        if points:
            last_close = points[-1]['close']
            print(f"图表最后收盘价: ${last_close}")
            print(f"差异: ${abs(current_price - last_close):.2f}")
            
            if abs(current_price - last_close) < 5:
                print("✓ 价格基本一致 (差异<$5)")
            else:
                print("⚠️ 价格差异较大")
except Exception as e:
    print(f"一致性检查失败: {e}")

print("\n=== 总结 ===")
print("混合方案特点:")
print("1. 使用真实实时报价")
print("2. 生成基于真实价格模式的历史数据")
print("3. 确保图表价格与当前价格一致")
print("4. 避免API限制问题")
print("5. 提供合理的价格波动模式")