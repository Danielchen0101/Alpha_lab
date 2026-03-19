"""
获取Finnhub实际返回的marketCap数据
"""

import requests
import json

def get_finnhub_stock_data(symbol):
    """获取Finnhub股票数据"""
    api_key = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"
    base_url = "https://finnhub.io/api/v1"
    
    # 获取profile2数据（包含marketCap）
    profile_endpoint = "/stock/profile2"
    profile_params = {"symbol": symbol, "token": api_key}
    
    # 获取quote数据
    quote_endpoint = "/quote"
    quote_params = {"symbol": symbol, "token": api_key}
    
    try:
        # 获取profile数据
        profile_response = requests.get(f"{base_url}{profile_endpoint}", params=profile_params, timeout=10)
        profile_data = profile_response.json() if profile_response.status_code == 200 else {}
        
        # 获取quote数据
        quote_response = requests.get(f"{base_url}{quote_endpoint}", params=quote_params, timeout=10)
        quote_data = quote_response.json() if quote_response.status_code == 200 else {}
        
        return {
            "symbol": symbol,
            "profile": profile_data,
            "quote": quote_data
        }
    except Exception as e:
        return {"symbol": symbol, "error": str(e)}

def test_multiple_stocks():
    """测试多只股票的marketCap数据"""
    print("=" * 80)
    print("测试Finnhub原始marketCap数据")
    print("=" * 80)
    
    symbols = ["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA", "AMZN", "META", "JPM", "JNJ", "V"]
    
    all_data = []
    for symbol in symbols:
        print(f"\n获取 {symbol} 数据...")
        data = get_finnhub_stock_data(symbol)
        all_data.append(data)
        
        if "error" in data:
            print(f"  错误: {data['error']}")
            continue
            
        profile = data.get("profile", {})
        quote = data.get("quote", {})
        
        print(f"  公司名称: {profile.get('name', 'N/A')}")
        print(f"  marketCapitalization: {profile.get('marketCapitalization', 'N/A')}")
        print(f"  货币: {profile.get('currency', 'N/A')}")
        print(f"  当前价格: {quote.get('c', 'N/A')}")
        print(f"  涨跌: {quote.get('d', 'N/A')}")
        print(f"  涨跌幅: {quote.get('dp', 'N/A')}%")
    
    print(f"\n{'='*80}")
    print("数据分析")
    print(f"{'='*80}")
    
    # 分析marketCap数据
    print("\nmarketCapitalization字段分析:")
    valid_market_caps = []
    for data in all_data:
        if "error" in data:
            continue
            
        symbol = data["symbol"]
        profile = data.get("profile", {})
        market_cap = profile.get("marketCapitalization")
        
        if market_cap is not None:
            valid_market_caps.append((symbol, market_cap))
            print(f"  {symbol}: {market_cap}")
    
    if valid_market_caps:
        print(f"\nmarketCap单位分析:")
        print(f"  样本数量: {len(valid_market_caps)}")
        
        # 检查是否是百万单位
        # 已知AAPL市值约3.7万亿美元 = 3,700,000 百万美元
        aapl_market_cap = next((cap for sym, cap in valid_market_caps if sym == "AAPL"), None)
        if aapl_market_cap:
            print(f"  AAPL marketCap: {aapl_market_cap}")
            print(f"  如果这是百万美元单位，则实际市值: ${aapl_market_cap:,} 百万美元")
            print(f"  转换为万亿美元: ${aapl_market_cap / 1000:,.2f} 万亿美元")
            print(f"  转换为美元: ${aapl_market_cap * 1_000_000:,.0f} 美元")
        
        # 检查所有股票
        print(f"\n所有股票marketCap值:")
        for symbol, market_cap in valid_market_caps:
            print(f"  {symbol}: {market_cap:,.2f} (百万美元: {market_cap}, 美元: {market_cap * 1_000_000:,.0f})")
    
    print(f"\n{'='*80}")
    print("结论")
    print(f"{'='*80}")
    
    # 基于数据分析得出结论
    if valid_market_caps:
        print("基于数据分析:")
        print("1. Finnhub的marketCapitalization字段是百万美元单位")
        print("2. 需要乘以1,000,000得到实际美元市值")
        print("3. 示例:")
        print(f"   - AAPL: {aapl_market_cap} 百万美元 = ${aapl_market_cap * 1_000_000:,.0f} 美元")
        print(f"   - 转换为万亿: ${aapl_market_cap / 1000:,.2f} 万亿美元")
    else:
        print("无法获取有效数据进行分析")

if __name__ == "__main__":
    test_multiple_stocks()