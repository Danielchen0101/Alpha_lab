import requests
import json
import time

print("测试修复后的后端...")
print("="*80)

# 测试不同的时间范围
test_cases = [
    {"interval": "30", "range": "1day", "desc": "1 Day (30分钟 -> 小时数据)"},
    {"interval": "60", "range": "1week", "desc": "1 Week (60分钟 -> 小时数据)"},
    {"interval": "D", "range": "1month", "desc": "1 Month (日线)"},
    {"interval": "D", "range": "3month", "desc": "3 Months (日线)"},
    {"interval": "D", "range": "1year", "desc": "1 Year (日线)"},
]

print("第一轮测试 - 初始请求:")
for test in test_cases:
    print(f"\n测试: {test['desc']}")
    
    try:
        start_time = time.time()
        r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                        params={'interval': test['interval'], 'range': test['range']}, 
                        timeout=15)
        elapsed = time.time() - start_time
        
        print(f"  响应时间: {elapsed:.2f}秒")
        print(f"  状态码: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            print(f"  数据源: {data.get('dataSource')}")
            print(f"  数据条数: {data.get('count', 0)}")
            print(f"  是否真实数据: {data.get('isRealData', '未知')}")
            print(f"  备注: {data.get('note', '无')}")
            
            points = data.get('data', [])
            if points:
                print(f"  价格范围: ${min(p['close'] for p in points):.2f} - ${max(p['close'] for p in points):.2f}")
        else:
            print(f"  错误: {r.text[:200]}")
            
    except Exception as e:
        print(f"  请求失败: {e}")

# 等待2秒后测试缓存
print(f"\n{'='*80}")
print("第二轮测试 - 缓存测试 (2秒后):")
time.sleep(2)

for test in test_cases[:2]:  # 只测试day和week
    print(f"\n测试缓存: {test['desc']}")
    
    try:
        start_time = time.time()
        r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                        params={'interval': test['interval'], 'range': test['range']}, 
                        timeout=15)
        elapsed = time.time() - start_time
        
        print(f"  响应时间: {elapsed:.2f}秒 (缓存应该更快)")
        print(f"  状态码: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            print(f"  数据源: {data.get('dataSource')}")
            print(f"  数据条数: {data.get('count', 0)}")
            
            # 检查是否来自缓存（响应时间应该很短）
            if elapsed < 0.1:
                print(f"  ✓ 可能来自缓存 (响应时间: {elapsed:.3f}秒)")
            else:
                print(f"  ⚠️ 可能重新请求 (响应时间: {elapsed:.3f}秒)")
        else:
            print(f"  错误: {r.text[:200]}")
            
    except Exception as e:
        print(f"  请求失败: {e}")

# 测试错误处理
print(f"\n{'='*80}")
print("第三轮测试 - 错误处理:")
print("测试不存在的股票和不支持的粒度...")

error_cases = [
    {"symbol": "INVALID", "interval": "D", "range": "1month", "desc": "无效股票"},
    {"symbol": "AAPL", "interval": "invalid", "range": "1month", "desc": "无效粒度"},
]

for test in error_cases:
    print(f"\n测试: {test['desc']}")
    
    try:
        r = requests.get(f'http://127.0.0.1:8890/api/market/history/{test["symbol"]}', 
                        params={'interval': test['interval'], 'range': test['range']}, 
                        timeout=10)
        
        print(f"  状态码: {r.status_code}")
        
        if r.status_code == 200:
            data = r.json()
            print(f"  数据源: {data.get('dataSource')}")
            print(f"  数据条数: {data.get('count', 0)}")
            print(f"  错误信息: {data.get('error', '无')}")
        else:
            print(f"  错误: {r.text[:200]}")
            
    except Exception as e:
        print(f"  请求失败: {e}")

print(f"\n{'='*80}")
print("测试总结:")
print("1. 检查Polygon分辨率映射是否正确 (30/60 -> hour)")
print("2. 检查缓存是否工作 (第二响应应该更快)")
print("3. 检查错误处理是否清晰")
print("4. 检查是否避免了Polygon的rate limit")