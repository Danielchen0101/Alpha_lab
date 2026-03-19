#!/usr/bin/env python3
"""
最终测试market cap转换
"""

import requests
import json

def test_marketcap_final():
    """最终测试market cap"""
    print("最终测试market cap转换")
    print("=" * 80)
    
    # 测试单个股票
    symbols = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN"]
    
    for symbol in symbols:
        print(f"\n测试 {symbol}:")
        print("-" * 40)
        
        try:
            # 调用API
            response = requests.get(f"http://127.0.0.1:8889/api/market/stock/{symbol}", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                marketcap = data.get('marketCap')
                
                print(f"   API返回的marketCap: {marketcap}")
                
                if marketcap:
                    # 判断单位
                    if marketcap >= 1e12:
                        unit = "Trillion (T)"
                        formatted = f"${marketcap/1e12:.2f}T"
                        status = "[CORRECT]"
                    elif marketcap >= 1e9:
                        unit = "Billion (B)"
                        formatted = f"${marketcap/1e9:.2f}B"
                        status = "[CORRECT for small cap]"
                    elif marketcap >= 1e6:
                        unit = "Million (M)"
                        formatted = f"${marketcap/1e6:.2f}M"
                        status = "[ERROR for large cap]"
                    else:
                        unit = "Small"
                        formatted = f"${marketcap:,.2f}"
                        status = "[ERROR for large cap]"
                    
                    print(f"   单位判断: {unit}")
                    print(f"   应该显示: {formatted}")
                    print(f"   状态: {status}")
                else:
                    print(f"   [WARNING] marketCap为None")
            else:
                print(f"   [ERROR] API请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"   [ERROR] 测试失败: {str(e)}")
    
    # 测试Dashboard数据
    print("\n" + "=" * 80)
    print("测试Dashboard数据 (15只股票)")
    print("=" * 80)
    
    try:
        response = requests.get("http://127.0.0.1:8889/api/market/stocks?dashboard=true", timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"   股票数量: {len(stocks)}")
            
            # 计算总值
            total_marketcap = 0
            largest_cap = 0
            largest_symbol = ""
            
            for stock in stocks:
                marketcap = stock.get('marketCap')
                if marketcap:
                    total_marketcap += marketcap
                    if marketcap > largest_cap:
                        largest_cap = marketcap
                        largest_symbol = stock.get('symbol', '')
            
            print(f"\n   汇总统计:")
            print(f"   Total Market Cap (原始值): {total_marketcap:,.0f}")
            
            # 格式化显示
            if total_marketcap >= 1e12:
                formatted_total = f"${total_marketcap/1e12:.2f}T"
            elif total_marketcap >= 1e9:
                formatted_total = f"${total_marketcap/1e9:.2f}B"
            elif total_marketcap >= 1e6:
                formatted_total = f"${total_marketcap/1e6:.2f}M"
            else:
                formatted_total = f"${total_marketcap:,.2f}"
            
            print(f"   Total Market Cap (格式化): {formatted_total}")
            
            if largest_cap >= 1e12:
                formatted_largest = f"${largest_cap/1e12:.2f}T"
            elif largest_cap >= 1e9:
                formatted_largest = f"${largest_cap/1e9:.2f}B"
            elif largest_cap >= 1e6:
                formatted_largest = f"${largest_cap/1e6:.2f}M"
            else:
                formatted_largest = f"${largest_cap:,.2f}"
            
            print(f"   Largest Cap: {largest_symbol} {formatted_largest}")
            
            # 验证
            print(f"\n   验证:")
            if total_marketcap > 1e12 and "T" in formatted_total:
                print(f"   [SUCCESS] Total Market Cap正确显示为T级别")
            else:
                print(f"   [ERROR] Total Market Cap显示错误")
                
            if largest_cap > 1e12 and "T" in formatted_largest:
                print(f"   [SUCCESS] Largest Cap正确显示为T级别")
            else:
                print(f"   [ERROR] Largest Cap显示错误")
                
        else:
            print(f"   [ERROR] Dashboard请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"   [ERROR] Dashboard测试失败: {str(e)}")
    
    print("\n" + "=" * 80)

if __name__ == "__main__":
    test_marketcap_final()