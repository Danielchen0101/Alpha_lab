import requests
import json
import time

print("测试无模拟历史数据后端...")
time.sleep(2)

print("\n=== 测试历史数据接口 ===")

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
                        timeout=10)
        
        print(f"状态码: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            print(f"数据源: {data.get('dataSource')}")
            print(f"数据条数: {data.get('count')}")
            print(f"是否真实数据: {data.get('isRealData', '未知')}")
            print(f"备注: {data.get('note', '无')}")
            
            if 'error' in data:
                print(f"错误: {data.get('error')}")
            
            points = data.get('data', [])
            if points:
                closes = [p['close'] for p in points]
                print(f"价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
                print(f"最后收盘价: ${closes[-1]:.2f}")
                print(f"前3个点:")
                for i, p in enumerate(points[:3]):
                    print(f"  {i+1}. timestamp={p['timestamp']}, close=${p['close']:.2f}")
            else:
                print("返回空数据 (正确行为)")
    except Exception as e:
        print(f"请求失败: {e}")

print("\n=== 测试单股详情 ===")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
    if r.status_code == 200:
        data = r.json()
        print(f"名称: {data.get('name')}")
        print(f"价格: ${data.get('price')}")
        print(f"市值: ${data.get('marketCap'):,.0f}")
        print(f"数据源: {data.get('dataSource')}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n=== 测试系统状态 ===")
try:
    r = requests.get('http://127.0.0.1:8890/api/status', timeout=5)
    if r.status_code == 200:
        data = r.json()
        print(f"状态: {data.get('status')}")
        print(f"数据源: {data.get('dataSource')}")
        print(f"备注: {data.get('note')}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n=== 验证结果 ===")
print("期望行为:")
print("1. 历史数据接口返回空数据 (count: 0)")
print("2. 数据源显示 '数据不可用'")
print("3. 包含错误信息说明原因")
print("4. 不再生成模拟历史数据")
print("5. 实时报价仍然工作正常")
print("6. 公司名称和市值正确")