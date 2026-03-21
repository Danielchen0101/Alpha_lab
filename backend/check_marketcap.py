import requests

print("检查NVDA市值数据...")
try:
    response = requests.get('http://127.0.0.1:8889/api/market/stock/NVDA', timeout=5)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        market_cap = data.get('marketCap')
        print(f"NVDA市值原始值: {market_cap}")
        print(f"格式化显示: {market_cap:,}")
        print(f"转换为万亿: {market_cap / 1_000_000_000_000:.2f}T")
        print(f"转换为十亿: {market_cap / 1_000_000_000:.2f}B")
        
        # 检查是否是重复换算的问题
        print(f"\n检查重复换算:")
        print(f"原始值 / 1,000,000 = {market_cap / 1_000_000:.2f}")
        print(f"原始值 / 1,000,000,000 = {market_cap / 1_000_000_000:.2f}")
        print(f"原始值 / 1,000,000,000,000 = {market_cap / 1_000_000_000_000:.2f}")
        
    else:
        print(f"错误: {response.text}")
except Exception as e:
    print(f"请求失败: {e}")