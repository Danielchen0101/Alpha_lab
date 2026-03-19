#!/usr/bin/env python3
"""
分析股票涨跌平衡性
"""

import requests
import time

def analyze_stock_balance():
    """分析股票涨跌平衡性"""
    print("分析当前15支股票的涨跌平衡性")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    current_stocks = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", 
        "JPM", "JNJ", "WMT", "V", "PG", "UNH", "HD", "MA"
    ]
    
    print(f"当前15支股票: {', '.join(current_stocks)}")
    print(f"科技股: AAPL, MSFT, GOOGL, AMZN, NVDA, META (6/15 = 40%)")
    
    # 获取实时数据
    symbols_param = ','.join(current_stocks)
    url = f"{base_url}/market/stocks?dashboard=true&symbols={symbols_param}"
    
    try:
        response = requests.get(url, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"\n实时涨跌分析:")
            print("-" * 60)
            
            gainers = []
            losers = []
            neutral = []
            
            for stock in stocks:
                symbol = stock.get('symbol')
                change_percent = stock.get('changePercent', 0)
                price = stock.get('price', 0)
                
                if change_percent > 0.1:  # 上涨超过0.1%
                    gainers.append((symbol, change_percent, price))
                elif change_percent < -0.1:  # 下跌超过0.1%
                    losers.append((symbol, change_percent, price))
                else:
                    neutral.append((symbol, change_percent, price))
            
            # 排序
            gainers.sort(key=lambda x: x[1], reverse=True)
            losers.sort(key=lambda x: x[1])
            
            print(f"上涨股票 ({len(gainers)}支):")
            for symbol, change, price in gainers:
                print(f"  {symbol}: +{change:.2f}% (${price:.2f})")
            
            print(f"\n下跌股票 ({len(losers)}支):")
            for symbol, change, price in losers:
                print(f"  {symbol}: {change:.2f}% (${price:.2f})")
            
            print(f"\n平盘股票 ({len(neutral)}支):")
            for symbol, change, price in neutral:
                print(f"  {symbol}: {change:.2f}% (${price:.2f})")
            
            print(f"\n平衡性分析:")
            print(f"  上涨: {len(gainers)}支 ({len(gainers)/15*100:.1f}%)")
            print(f"  下跌: {len(losers)}支 ({len(losers)/15*100:.1f}%)")
            print(f"  平盘: {len(neutral)}支 ({len(neutral)/15*100:.1f}%)")
            
            # 建议调整
            print(f"\n建议调整:")
            if len(gainers) > 8:
                print(f"  ⚠️ 上涨股票偏多 ({len(gainers)}支)，建议替换一些为下跌股票")
            elif len(losers) > 8:
                print(f"  ⚠️ 下跌股票偏多 ({len(losers)}支)，建议替换一些为上涨股票")
            else:
                print(f"  ✅ 涨跌平衡良好")
            
            # 科技股分析
            tech_stocks = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "ADBE", "CRM", "NFLX"]
            current_tech = [s for s in current_stocks if s in tech_stocks]
            print(f"\n科技股分析:")
            print(f"  当前科技股: {', '.join(current_tech)} ({len(current_tech)}/15 = {len(current_tech)/15*100:.1f}%)")
            
            if len(current_tech) < 5:
                print(f"  ⚠️ 科技股偏少，建议增加")
            elif len(current_tech) > 8:
                print(f"  ⚠️ 科技股偏多，建议减少")
            else:
                print(f"  ✅ 科技股比例合理")
            
            # 显示最大涨跌幅
            all_stocks = gainers + losers + neutral
            if all_stocks:
                largest_move = max(all_stocks, key=lambda x: abs(x[1]))
                print(f"\n最大涨跌幅股票:")
                print(f"  {largest_move[0]}: {largest_move[1]:+.2f}% (${largest_move[2]:.2f})")
            
        else:
            print(f"请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"分析异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    analyze_stock_balance()