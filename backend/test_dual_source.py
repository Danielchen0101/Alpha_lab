import requests
import json
import time

print("测试双源后端...")
time.sleep(2)

print("\n=== 测试历史数据 (Polygon为主) ===")

test_cases = [
    {"interval": "60", "range": "1day", "desc": "1 Day数据"},
    {"interval": "D", "range": "1month", "desc": "1 Month数据"},
    {"interval": "D", "range": "1year", "desc": "1 Year数据"},
]

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
            print(f"是否真实数据: {data.get('isRealData', '未知')}")
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
                
                print(f"前3个点:")
                for i, p in enumerate(points[:3]):
                    date_str = time.strftime('%Y-%m-%d', time.localtime(p['timestamp']))
                    print(f"  {i+1}. {date_str}: O=${p['open']:.2f}, H=${p['high']:.2f}, L=${p['low']:.2f}, C=${p['close']:.2f}")
            else:
                print("返回空数据")
    except Exception as e:
        print(f"请求失败: {e}")

print("\n=== 测试单股详情 (Finnhub为主) ===")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
    if r.status_code == 200:
        data = r.json()
        print(f"名称: {data.get('name')}")
        print(f"价格: ${data.get('price')}")
        print(f"市值: ${data.get('marketCap'):,.0f}")
        print(f"数据源: {data.get('dataSource')}")
        print(f"涨跌: ${data.get('change'):.2f}")
        print(f"涨跌幅: {data.get('changePercent'):.2f}%")
        print(f"今日最高: ${data.get('dayHigh')}")
        print(f"今日最低: ${data.get('dayLow')}")
        print(f"前收盘: ${data.get('previousClose')}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n=== 测试其他股票历史数据 ===")
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

print("\n=== 测试系统状态 ===")
try:
    r = requests.get('http://127.0.0.1:8890/api/status', timeout=5)
    if r.status_code == 200:
        data = r.json()
        print(f"状态: {data.get('status')}")
        print(f"数据源: {data.get('dataSource')}")
        print(f"备注: {data.get('note')}")
        print(f"API状态: {json.dumps(data.get('apis', {}), indent=2)}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

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
        else:
            print("图表无数据")
except Exception as e:
    print(f"一致性检查失败: {e}")

print("\n=== 验证结果 ===")
print("期望行为:")
print("1. 历史数据使用Polygon (主源)")
print("2. 实时报价使用Finnhub (主源)")
print("3. 数据源明确标记")
print("4. 不再生成模拟历史数据")
print("5. 价格在合理范围")
print("6. 图表价格与页面价格基本一致")