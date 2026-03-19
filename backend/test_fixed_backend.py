import requests
import json

print("=== 测试修复后的后端API ===")

# 测试股票列表API
print("\n1. 测试 /api/market/stocks:")
try:
    response = requests.get("http://127.0.0.1:8889/api/market/stocks", timeout=10)
    print(f"   状态: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   股票数量: {data.get('count')}")
        print(f"   数据源: {data.get('source')}")
        print(f"   消息: {data.get('message')}")
        
        stocks = data.get('stocks', [])
        if stocks:
            print(f"\n   第一个股票数据 (AAPL):")
            first_stock = stocks[0]
            for key, value in first_stock.items():
                print(f"     {key}: {value}")
            
            print(f"\n   字段完整性检查:")
            required_fields = ['symbol', 'name', 'price', 'change', 'changePercent', 'previousClose', 'volume', 'marketCap', 'sector']
            for field in required_fields:
                value = first_stock.get(field)
                status = '✅ 有值' if value is not None else '❌ 空值'
                if field == 'sector' and value is None:
                    status = '⚠️ 预期为空 (API限制)'
                print(f"     {field}: {value} ({status})")
    else:
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"   错误: {e}")

# 测试单个股票API
print("\n2. 测试 /api/market/stock/AAPL:")
try:
    response = requests.get("http://127.0.0.1:8889/api/market/stock/AAPL", timeout=10)
    print(f"   状态: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"\n   股票详情:")
        for key, value in data.items():
            print(f"     {key}: {value}")
    else:
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"   错误: {e}")

print("\n=== 分析结果 ===")
print("1. 修复后的字段:")
print("   - price: 使用前收盘价 (免费API限制)")
print("   - change: 固定为0 (免费API限制)")
print("   - changePercent: 固定为0 (免费API限制)")
print("   - previousClose: 前收盘价")
print("   - sector: None (API不提供)")
print("   - dataSource: 明确标注为Free Plan")

print("\n2. 对Dashboard的影响:")
print("   - Watchlist: 显示0.00%涨跌幅 (真实数据，不是mock)")
print("   - Top Gainers/Losers: 所有股票都是0%，显示空状态")
print("   - Market Breadth: 所有股票都是平盘")
print("   - Sector Distribution: 显示数据不可用")

print("\n3. 限制说明:")
print("   - 这是Polygon.io免费计划的限制")
print("   - 实时价格和涨跌幅需要升级到付费计划")
print("   - 行业数据需要其他数据源或付费API")