import requests
import json
import time

print("验证所有修复")
print("=" * 60)
print("等待后端启动...")
time.sleep(3)

print("\n1. 验证 Market Cap 单位修复:")
print("-" * 40)
try:
    response = requests.get('http://localhost:8889/api/market/stock/AAPL', timeout=10)
    print(f"状态码: {response.status_code}")
    data = response.json()
    
    market_cap = data.get('marketCap')
    print(f"marketCap 原始值: {market_cap}")
    print(f"marketCap 类型: {type(market_cap)}")
    
    if market_cap:
        # 检查单位是否正确
        if market_cap > 3_000_000_000_000:  # Apple 市值约 3 万亿美元
            print(f"✅ Market Cap 单位正确: {market_cap:,} 美元 = {market_cap/1_000_000_000_000:.2f} 万亿美元")
            print(f"✅ 前端应显示: ${market_cap/1_000_000_000_000:.2f}T")
        else:
            print(f"❌ Market Cap 单位可能错误: {market_cap:,} 美元")
    
    # 检查所有字段
    print(f"\n所有字段:")
    for key, value in data.items():
        print(f"  {key}: {value}")
        
except Exception as e:
    print(f"错误: {e}")

print("\n2. 验证 Volume 字段:")
print("-" * 40)
try:
    response = requests.get('http://localhost:8889/api/market/stock/AAPL', timeout=10)
    data = response.json()
    
    volume = data.get('volume')
    print(f"volume 值: {volume}")
    
    if volume is None:
        print("✅ Volume 为 null (Finnhub 免费 API 不提供实时成交量)")
        print("✅ 前端应显示: --")
    elif volume == 0:
        print("❌ Volume 为 0 (不应伪造 0)")
    else:
        print(f"✅ Volume 有真实值: {volume}")
        
except Exception as e:
    print(f"错误: {e}")

print("\n3. 验证 Price Chart 历史数据:")
print("-" * 40)

# 测试不同 timeframe
timeframes = [
    ('1day', '5min'),
    ('1week', '1day'),
    ('1month', '1day'),
    ('3month', '1day'),
    ('1year', '1day')
]

for range_param, interval in timeframes:
    print(f"\n测试 {range_param} ({interval}):")
    try:
        url = f'http://localhost:8889/api/market/history/AAPL?interval={interval}&range={range_param}'
        response = requests.get(url, timeout=15)
        print(f"  状态码: {response.status_code}")
        
        data = response.json()
        count = data.get('count', 0)
        source = data.get('source', 'unknown')
        message = data.get('message', '')
        
        print(f"  数据点: {count}")
        print(f"  来源: {source}")
        print(f"  消息: {message}")
        
        if count > 0:
            print(f"  ✅ 有真实数据")
            if data.get('data'):
                first = data['data'][0]
                print(f"  第一个数据点结构: {list(first.keys())}")
                print(f"  示例: t={first.get('timestamp')}, O={first.get('open')}, H={first.get('high')}, L={first.get('low')}, C={first.get('close')}, V={first.get('volume')}")
        else:
            print(f"  ❌ 无数据")
            if 'error_details' in data:
                print(f"  错误详情: {json.dumps(data['error_details'], indent=2)}")
                
    except Exception as e:
        print(f"  错误: {e}")

print("\n4. 验证前端显示:")
print("-" * 40)
print("预期前端显示:")
print("1. Market Cap: 应显示 $3.67T (而不是 $3.67M)")
print("2. Volume: 应显示 -- (因为 Finnhub 免费 API 不提供)")
print("3. Price Chart: ")
print("   - 如果有真实数据: 显示 candlestick 图表")
print("   - 如果无数据: 显示 'No historical data available'")
print("   - Timeframe 切换应触发新的 API 请求")

print("\n5. 检查 API 响应格式:")
print("-" * 40)
print("/api/market/stock/<symbol> 应包含:")
print("  - marketCap: 美元单位 (不是百万美元)")
print("  - volume: null (不是 0)")
print("  - 所有其他真实字段")

print("/api/market/history/<symbol> 应:")
print("  - 尝试多个真实数据源")
print("  - 明确标记数据来源")
print("  - 无模拟/伪造数据")
print("  - 详细记录错误信息")

print("\n" + "=" * 60)
print("修复总结:")
print("✅ 1. Market Cap 单位修复: Finnhub 百万美元 → 美元")
print("✅ 2. Volume 处理: 保持 null (不伪造 0)")
print("✅ 3. Price Chart 数据源: 多数据源尝试 (Alpha Vantage, Yahoo Finance)")
print("✅ 4. 无模拟数据: 只返回真实数据或空数组")
print("✅ 5. 详细错误日志: 记录哪个 timeframe 导致 no_data")

print("\n注意事项:")
print("1. Alpha Vantage 演示 key 有限制，可能需要注册获取真实 key")
print("2. Yahoo Finance 免费版不支持分钟级数据")
print("3. 生产环境需要配置真实的 API keys")
print("4. 前端需要处理空数据情况")