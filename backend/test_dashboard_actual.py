import requests
import json

print("=== 检查Dashboard实际数据状态 ===")

# 测试股票列表API
print("\n1. 检查股票列表数据:")
try:
    response = requests.get("http://127.0.0.1:8889/api/market/stocks", timeout=10)
    print(f"   状态: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        stocks = data.get('stocks', [])
        print(f"   股票数量: {len(stocks)}")
        
        for i, stock in enumerate(stocks):
            print(f"\n   [{i+1}] {stock.get('symbol')}:")
            print(f"      名称: {stock.get('name')}")
            print(f"      价格: {stock.get('price')}")
            print(f"      涨跌幅: {stock.get('changePercent')}")
            print(f"      涨跌额: {stock.get('change')}")
            print(f"      前收盘: {stock.get('previousClose')}")
            print(f"      成交量: {stock.get('volume')}")
            print(f"      市值: {stock.get('marketCap')}")
            print(f"      行业: {stock.get('sector')}")
            print(f"      数据源: {stock.get('dataSource')}")
            
            # 计算涨跌幅
            price = stock.get('price')
            prev_close = stock.get('previousClose')
            if price is not None and prev_close is not None and prev_close != 0:
                calculated_change = ((price - prev_close) / prev_close) * 100
                print(f"      计算涨跌幅: {calculated_change:.2f}%")
    else:
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"   错误: {e}")

print("\n=== 分析结果 ===")
print("1. 检查涨跌幅字段:")
print("   - changePercent 字段是否为 null/None?")
print("   - change 字段是否有值?")
print("   - previousClose 字段是否有值?")
print("   - 能否通过 price 和 previousClose 计算涨跌幅?")

print("\n2. 检查行业字段:")
print("   - sector 字段是否为 null/None?")
print("   - 是否所有股票都是 'Unknown'?")

print("\n3. 数据完整性:")
print("   - 是否有足够的股票数据用于统计?")
print("   - 关键字段是否都有值?")

print("\n=== 测试完成 ===")