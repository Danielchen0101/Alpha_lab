"""
获取Dashboard显示的15支股票原始数据并手工核算
"""

import requests
import json
from datetime import datetime

def get_stock_data_from_backend():
    """从后端API获取15支股票数据"""
    base_url = "http://127.0.0.1:8889"
    
    try:
        # 获取15支股票数据（后端默认已改为15支）
        response = requests.get(
            f"{base_url}/api/market/stocks",
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            return data
        else:
            print(f"API错误: {response.status_code}")
            print(f"响应: {response.text}")
            return None
            
    except Exception as e:
        print(f"请求失败: {type(e).__name__}: {str(e)}")
        return None

def analyze_stock_data(data):
    """分析股票数据并手工核算"""
    if not data or "stocks" not in data:
        print("没有获取到股票数据")
        return
    
    stocks = data["stocks"]
    print("=" * 100)
    print("当前15支股票原始数据表")
    print("=" * 100)
    
    # 打印表头
    print(f"{'Symbol':<8} {'Price':<10} {'Change':<10} {'Change%':<10} {'MarketCap($)':<20} {'Sector':<20}")
    print("-" * 100)
    
    # 打印每只股票数据
    stock_details = []
    for stock in stocks:
        symbol = stock.get("symbol", "N/A")
        price = stock.get("price", 0)
        change = stock.get("change", 0)
        change_percent = stock.get("changePercent", 0)
        market_cap = stock.get("marketCap", 0)
        sector = stock.get("sector", "Unknown")
        
        # 格式化marketCap为易读格式
        if market_cap and market_cap >= 1e12:
            market_cap_str = f"${market_cap/1e12:.2f}T"
        elif market_cap and market_cap >= 1e9:
            market_cap_str = f"${market_cap/1e9:.2f}B"
        else:
            market_cap_str = f"${market_cap:,.0f}"
        
        print(f"{symbol:<8} ${price:<9.2f} ${change:<9.2f} {change_percent:<9.2f}% {market_cap_str:<20} {sector:<20}")
        
        stock_details.append({
            "symbol": symbol,
            "price": price,
            "change": change,
            "changePercent": change_percent,
            "marketCap": market_cap,
            "sector": sector
        })
    
    print("=" * 100)
    print("\n手工核算所有summary")
    print("=" * 100)
    
    # 1. Total Symbols
    total_symbols = len(stock_details)
    print(f"1. Total Symbols = {total_symbols}")
    
    # 2. Market Gainers / Losers
    gainers = sum(1 for s in stock_details if s["changePercent"] and s["changePercent"] > 0)
    losers = sum(1 for s in stock_details if s["changePercent"] and s["changePercent"] < 0)
    flat = sum(1 for s in stock_details if s["changePercent"] == 0 or s["changePercent"] is None)
    
    print(f"2. Market Gainers = {gainers}")
    print(f"3. Market Losers = {losers}")
    print(f"   Flat/Unknown = {flat}")
    print(f"   验证: {gainers} + {losers} + {flat} = {gainers + losers + flat} (应该等于 {total_symbols})")
    
    # 3. Average Change
    valid_changes = [s["changePercent"] for s in stock_details if s["changePercent"] is not None]
    avg_change = sum(valid_changes) / len(valid_changes) if valid_changes else 0
    print(f"4. Average Change = {avg_change:.2f}%")
    
    # 4. Total Market Cap
    valid_market_caps = [s["marketCap"] for s in stock_details if s["marketCap"]]
    total_market_cap = sum(valid_market_caps) if valid_market_caps else 0
    print(f"5. Total Market Cap = ${total_market_cap:,.0f} 美元")
    print(f"   格式化: ${total_market_cap/1e12:.2f}T")
    
    # 5. Largest Cap
    if valid_market_caps:
        largest_stock = max(stock_details, key=lambda x: x["marketCap"] or 0)
        print(f"6. Largest Cap = {largest_stock['symbol']} ${largest_stock['marketCap']:,.0f} 美元")
        print(f"   格式化: {largest_stock['symbol']} ${largest_stock['marketCap']/1e12:.2f}T")
    
    # 6. Sectors Covered
    sectors = set(s["sector"] for s in stock_details if s["sector"] and s["sector"] != "Unknown")
    sectors_covered = len(sectors)
    print(f"7. Sectors Covered = {sectors_covered}")
    print(f"   行业列表: {', '.join(sorted(sectors))}")
    
    # 7. Sector Distribution
    print(f"\n8. Sector Distribution:")
    sector_counts = {}
    for s in stock_details:
        sector = s["sector"] or "Unknown"
        sector_counts[sector] = sector_counts.get(sector, 0) + 1
    
    for sector, count in sorted(sector_counts.items()):
        percentage = (count / total_symbols) * 100
        print(f"   {sector:<25} {count:>2} 只 ({percentage:>5.1f}%)")
    
    # 8. Market Breadth
    print(f"\n9. Market Breadth:")
    print(f"   Advancing (上涨): {gainers} 只 ({gainers/total_symbols*100:.1f}%)")
    print(f"   Declining (下跌): {losers} 只 ({losers/total_symbols*100:.1f}%)")
    print(f"   Flat (平盘): {flat} 只 ({flat/total_symbols*100:.1f}%)")
    
    # 9. Top Gainers / Top Losers 排序验证
    print(f"\n10. Top Gainers / Top Losers 排序验证:")
    
    # Top Gainers (前5名)
    top_gainers = sorted(
        [s for s in stock_details if s["changePercent"] and s["changePercent"] > 0],
        key=lambda x: x["changePercent"],
        reverse=True
    )[:5]
    
    print(f"   Top Gainers (前5名):")
    for i, stock in enumerate(top_gainers, 1):
        print(f"     {i}. {stock['symbol']}: {stock['changePercent']:.2f}%")
    
    # Top Losers (前5名)
    top_losers = sorted(
        [s for s in stock_details if s["changePercent"] and s["changePercent"] < 0],
        key=lambda x: x["changePercent"]
    )[:5]
    
    print(f"   Top Losers (前5名):")
    for i, stock in enumerate(top_losers, 1):
        print(f"     {i}. {stock['symbol']}: {stock['changePercent']:.2f}%")
    
    print("\n" + "=" * 100)
    print("数据验证结论")
    print("=" * 100)
    
    # 与Dashboard显示的数据对比
    dashboard_data = {
        "total_symbols": 15,
        "gainers": 6,
        "losers": 9,
        "avg_change": -0.01,
        "total_market_cap_t": 24.6,
        "largest_cap": "NVDA",
        "largest_cap_t": 4.42,
        "sectors_covered": 10
    }
    
    print("与Dashboard显示对比:")
    print(f"1. Total Symbols: 前端显示={dashboard_data['total_symbols']}, 实际={total_symbols} → {'✅ 一致' if dashboard_data['total_symbols'] == total_symbols else '❌ 不一致'}")
    print(f"2. Market Gainers: 前端显示={dashboard_data['gainers']}, 实际={gainers} → {'✅ 一致' if dashboard_data['gainers'] == gainers else '❌ 不一致'}")
    print(f"3. Market Losers: 前端显示={dashboard_data['losers']}, 实际={losers} → {'✅ 一致' if dashboard_data['losers'] == losers else '❌ 不一致'}")
    print(f"4. Average Change: 前端显示={dashboard_data['avg_change']}%, 实际={avg_change:.2f}% → {'✅ 一致' if abs(dashboard_data['avg_change'] - avg_change) < 0.1 else '❌ 不一致'}")
    print(f"5. Total Market Cap: 前端显示=${dashboard_data['total_market_cap_t']}T, 实际=${total_market_cap/1e12:.2f}T → {'✅ 一致' if abs(dashboard_data['total_market_cap_t'] - total_market_cap/1e12) < 0.1 else '❌ 不一致'}")
    print(f"6. Largest Cap: 前端显示={dashboard_data['largest_cap']}, 实际={largest_stock['symbol'] if valid_market_caps else 'N/A'} → {'✅ 一致' if valid_market_caps and dashboard_data['largest_cap'] == largest_stock['symbol'] else '❌ 不一致'}")
    print(f"7. Largest Cap Value: 前端显示=${dashboard_data['largest_cap_t']}T, 实际=${largest_stock['marketCap']/1e12:.2f}T if valid_market_caps else 'N/A' → {'✅ 一致' if valid_market_caps and abs(dashboard_data['largest_cap_t'] - largest_stock['marketCap']/1e12) < 0.1 else '❌ 不一致'}")
    print(f"8. Sectors Covered: 前端显示={dashboard_data['sectors_covered']}, 实际={sectors_covered} → {'✅ 一致' if dashboard_data['sectors_covered'] == sectors_covered else '❌ 不一致'}")

def main():
    """主函数"""
    print("正在获取Dashboard数据...")
    data = get_stock_data_from_backend()
    
    if data:
        analyze_stock_data(data)
    else:
        print("无法获取数据，请确保后端正在运行")

if __name__ == "__main__":
    main()