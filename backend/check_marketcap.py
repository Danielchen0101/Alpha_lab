import requests
import json

print("检查 Market Cap 单位问题")
print("=" * 60)

# 1. 直接调用后端 API
print("\n1. 后端 API 原始响应 (/api/market/stock/AAPL):")
try:
    response = requests.get('http://localhost:8889/api/market/stock/AAPL', timeout=10)
    print(f"状态码: {response.status_code}")
    data = response.json()
    print(f"完整 JSON 响应:")
    print(json.dumps(data, indent=2))
    
    market_cap = data.get('marketCap')
    print(f"\nmarketCap 原始值: {market_cap}")
    print(f"marketCap 类型: {type(market_cap)}")
    
    # 分析单位
    if market_cap:
        if market_cap > 1_000_000_000_000:  # 万亿
            print(f"单位分析: {market_cap:,} = {market_cap/1_000_000_000_000:.2f} 万亿美元")
        elif market_cap > 1_000_000_000:  # 十亿
            print(f"单位分析: {market_cap:,} = {market_cap/1_000_000_000:.2f} 十亿美元")
        elif market_cap > 1_000_000:  # 百万
            print(f"单位分析: {market_cap:,} = {market_cap/1_000_000:.2f} 百万美元")
        else:
            print(f"单位分析: {market_cap:,} 美元")
            
except Exception as e:
    print(f"错误: {e}")

# 2. 直接调用 Finnhub API 验证
print("\n" + "=" * 60)
print("2. 直接调用 Finnhub API 验证:")

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'

# 调用 profile2 API
print("\na) Finnhub profile2 API 原始响应:")
try:
    url = "https://finnhub.io/api/v1/stock/profile2"
    params = {
        "symbol": "AAPL",
        "token": FINNHUB_API_KEY
    }
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    profile_data = response.json()
    print(f"完整响应:")
    print(json.dumps(profile_data, indent=2))
    
    market_cap_raw = profile_data.get('marketCapitalization')
    print(f"\nmarketCapitalization 原始值: {market_cap_raw}")
    print(f"类型: {type(market_cap_raw)}")
    
except Exception as e:
    print(f"错误: {e}")

# 3. 检查前端格式化
print("\n" + "=" * 60)
print("3. 检查前端格式化逻辑:")

# 读取前端格式化代码
import os
frontend_path = r"C:\Users\kexuc\.openclaw\workspace\professional_quant_platform\frontend\src\pages\SymbolAnalysis.tsx"
if os.path.exists(frontend_path):
    print(f"前端文件存在: {frontend_path}")
    
    # 搜索 formatCurrency 或 marketCap 相关代码
    with open(frontend_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # 查找 formatCurrency 函数
    import re
    format_currency_match = re.search(r'function formatCurrency.*?\n}', content, re.DOTALL)
    if format_currency_match:
        print("\n找到 formatCurrency 函数:")
        print(format_currency_match.group(0)[:500] + "...")
    
    # 查找 marketCap 显示代码
    marketcap_matches = re.findall(r'marketCap.*?}', content, re.DOTALL)
    if marketcap_matches:
        print("\n找到 marketCap 相关代码:")
        for match in marketcap_matches[:3]:
            print(match[:200])
else:
    print(f"前端文件不存在: {frontend_path}")