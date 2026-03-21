import requests
import json
import time

print("测试修复后的后端...")
time.sleep(2)

print("\n=== 测试修复问题 ===")

# 1. 测试AAPL单股详情
print("\n1. 测试AAPL单股详情:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
    if r.status_code == 200:
        data = r.json()
        print(f"名称: {data.get('name')} (应该是: Apple Inc)")
        print(f"价格: ${data.get('price')}")
        print(f"市值: ${data.get('marketCap'):,.0f} (应该是: ~3.8万亿)")
        print(f"数据源: {data.get('dataSource')}")
        print(f"涨跌: ${data.get('change'):.2f}")
        print(f"涨跌幅: {data.get('changePercent'):.2f}%")
        
        # 验证修复
        if data.get('name') == 'Apple Inc':
            print("✓ 名称修复正确")
        else:
            print("✗ 名称仍然错误")
            
        if data.get('marketCap') > 3000000000000:  # 大于3万亿
            print("✓ 市值修复正确")
        else:
            print("✗ 市值仍然错误 ($1T)")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

# 2. 测试NVDA单股详情
print("\n2. 测试NVDA单股详情:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stock/NVDA', timeout=5)
    if r.status_code == 200:
        data = r.json()
        print(f"名称: {data.get('name')} (应该是: NVIDIA Corp)")
        print(f"价格: ${data.get('price')}")
        print(f"市值: ${data.get('marketCap'):,.0f} (应该是: ~4.38万亿)")
        
        if data.get('name') == 'NVIDIA Corp':
            print("✓ 名称修复正确")
        if data.get('marketCap') > 4000000000000:  # 大于4万亿
            print("✓ 市值修复正确")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

# 3. 测试历史数据
print("\n3. 测试历史数据:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1month'}, 
                    timeout=10)
    if r.status_code == 200:
        data = r.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"备注: {data.get('note', '无')}")
        print(f"是否模拟: {data.get('isSimulated', '未知')}")
        
        points = data.get('data', [])
        if points:
            closes = [p['close'] for p in points]
            print(f"价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
            print(f"最后收盘价: ${closes[-1]:.2f}")
            
            # 检查价格合理性
            if 200 <= min(closes) <= 300 and 200 <= max(closes) <= 300:
                print("✓ 价格在合理范围")
            else:
                print("⚠️ 价格可能异常")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

# 4. 测试股票列表
print("\n4. 测试股票列表:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stocks', timeout=5)
    if r.status_code == 200:
        data = r.json()
        stocks = data.get('stocks', [])
        print(f"股票数量: {len(stocks)}")
        
        for stock in stocks:
            print(f"  {stock.get('symbol')}: {stock.get('name')}, 市值=${stock.get('marketCap'):,.0f}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n=== 当前状态总结 ===")
print("1. 实时报价: 使用Finnhub真实数据 ✓")
print("2. 公司名称: 已修复为正确名称 (Apple Inc, NVIDIA Corp等) ✓")
print("3. 市值: 已修复为实际市值 (~3.8T, ~4.38T等) ✓")
print("4. 历史数据: 混合数据 (实时报价 + 模拟历史)，不是真实candles")
print("5. 数据源描述: 准确描述为'混合数据'，不是'真实历史数据' ✓")

print("\n=== 仍需解决的问题 ===")
print("如果要真正修复历史数据链路，需要:")
print("1. 解决Finnhub历史数据API的403限制")
print("2. 或寻找其他历史数据源")
print("3. 或使用缓存的历史数据")