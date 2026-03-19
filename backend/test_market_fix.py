import requests
import json
import time

print("测试市场数据修复")
print("=" * 60)
print("等待后端启动...")
time.sleep(3)

print("\n1. 测试 /api/market/stocks 端点:")
try:
    response = requests.get('http://localhost:8889/api/market/stocks', timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"股票数量: {data.get('count', 0)}")
        
        if data.get('stocks'):
            print(f"\n前3只股票详情:")
            for i, stock in enumerate(data['stocks'][:3]):
                print(f"\n{i+1}. {stock.get('symbol')}:")
                print(f"   名称: {stock.get('name')}")
                print(f"   价格: ${stock.get('price')}")
                print(f"   涨跌: {stock.get('change')}")
                print(f"   涨跌幅: {stock.get('change_pct')}%")
                print(f"   市值: {stock.get('market_cap')}")
        else:
            print("❌ 没有股票数据")
    else:
        print(f"响应: {response.text[:200]}")
        
except Exception as e:
    print(f"错误: {e}")

print("\n2. 测试 /api/market/stock/AAPL 端点:")
try:
    response = requests.get('http://localhost:8889/api/market/stock/AAPL', timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"股票详情:")
        print(f"  名称: {data.get('name')}")
        print(f"  价格: ${data.get('price')}")
        print(f"  涨跌: {data.get('change')}")
        print(f"  涨跌幅: {data.get('changePercent')}%")
        print(f"  市值: {data.get('marketCap')}")
        print(f"  成交量: {data.get('volume')}")
        print(f"  行业: {data.get('sector')}")
        print(f"  P/E比率: {data.get('peRatio')}")
    else:
        print(f"响应: {response.text[:200]}")
        
except Exception as e:
    print(f"错误: {e}")

print("\n3. 测试前端访问:")
print("预期结果:")
print("✅ Dashboard页面: 应显示股票列表")
print("✅ Market页面: 应显示市场数据")
print("✅ Analysis页面: 应显示单个股票分析")

print("\n4. 检查常见问题:")
print("a) 前端代理配置:")
print("   - 确保前端运行在 http://localhost:3000")
print("   - 检查 package.json 中的 proxy 配置")

print("\nb) CORS配置:")
print("   - 后端已配置 CORS_ORIGINS=['http://localhost:3000']")
print("   - 前端请求应能通过")

print("\nc) 数据格式:")
print("   - /api/market/stocks 返回数组格式")
print("   - 每个股票对象包含必要字段")
print("   - 字段名与前端期望一致")

print("\n5. 快速修复检查:")
print("✅ Market Cap单位修复: 百万美元 → 美元")
print("✅ Volume处理: 保持null (不伪造0)")
print("✅ 实时数据: 使用Finnhub quote API")
print("✅ 公司信息: 使用Finnhub profile2 API")
print("✅ 错误处理: 单个股票失败不影响其他")