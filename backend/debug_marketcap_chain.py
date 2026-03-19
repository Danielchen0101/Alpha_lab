#!/usr/bin/env python3
"""
Debug Market Cap Calculation Chain
分析market cap单位转换链路的问题
"""

import requests
import json
import time

def debug_marketcap_chain():
    """调试market cap计算链路"""
    print("=" * 100)
    print("MARKET CAP 单位转换链路调试")
    print("=" * 100)
    
    base_url = "http://127.0.0.1:8889/api"
    
    # 1. 获取Dashboard数据
    print("\n1. 获取Dashboard数据 (dashboard=true)")
    print("-" * 80)
    
    start_time = time.time()
    try:
        response = requests.get(f"{base_url}/market/stocks?dashboard=true", timeout=30)
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"[SUCCESS] 请求成功 ({elapsed:.2f}秒)")
            print(f"   数据源: {data.get('dataSource', 'Unknown')}")
            print(f"   股票数量: {data.get('count', 0)}")
            print(f"   是否成功: {data.get('success', 'N/A')}")
            
            stocks = data.get('stocks', [])
            
            if stocks:
                print("\n2. 15支股票的marketCap原始数据")
                print("-" * 80)
                
                # 创建数据表
                print(f"{'Symbol':<8} {'原始marketCap':<20} {'格式化显示':<15} {'单位判断':<12} {'状态':<20}")
                print("-" * 80)
                
                total_marketcap = 0
                largest_cap = 0
                largest_symbol = ""
                
                for stock in stocks:
                    symbol = stock.get('symbol', 'N/A')
                    marketcap_raw = stock.get('marketCap')
                    
                    # 计算总值和最大值
                    if marketcap_raw:
                        total_marketcap += marketcap_raw
                        if marketcap_raw > largest_cap:
                            largest_cap = marketcap_raw
                            largest_symbol = symbol
                    
                    # 判断单位
                    unit = "Unknown"
                    if marketcap_raw:
                        if marketcap_raw >= 1e12:
                            unit = "Trillion (T)"
                        elif marketcap_raw >= 1e9:
                            unit = "Billion (B)"
                        elif marketcap_raw >= 1e6:
                            unit = "Million (M)"
                        else:
                            unit = "Small"
                    
                    # 模拟前端formatMarketCap函数
                    formatted = format_marketcap(marketcap_raw)
                    
                    # 检查问题
                    status = "OK"
                    if marketcap_raw and marketcap_raw > 1e12 and "M" in formatted:
                        status = "ERROR: 应为T但显示为M"
                    elif marketcap_raw and marketcap_raw > 1e9 and marketcap_raw < 1e12 and "M" in formatted:
                        status = "ERROR: 应为B但显示为M"
                    
                    print(f"{symbol:<8} {str(marketcap_raw):<20} {formatted:<15} {unit:<12} {status:<20}")
                
                print("-" * 80)
                print(f"\n3. 汇总统计")
                print("-" * 80)
                
                # 模拟前端计算
                formatted_total = format_marketcap(total_marketcap)
                formatted_largest = format_marketcap(largest_cap)
                
                print(f"   Total Market Cap (原始值): {total_marketcap:,.2f}")
                print(f"   Total Market Cap (格式化): {formatted_total}")
                print(f"   Largest Cap (原始值): {largest_cap:,.2f}")
                print(f"   Largest Cap (格式化): {largest_symbol} {formatted_largest}")
                
                # 检查问题
                print(f"\n4. 问题诊断")
                print("-" * 80)
                
                if "M" in formatted_total and total_marketcap > 1e12:
                    print(f"   [CRITICAL] Total Market Cap显示为M，但原始值应为T级别!")
                    print(f"     原始值: {total_marketcap:,.2f} (应该是万亿级别)")
                    print(f"     显示为: {formatted_total} (错误显示为百万级别)")
                    print(f"     问题: 单位转换错误或格式化函数错误")
                
                if "M" in formatted_largest and largest_cap > 1e12:
                    print(f"   [CRITICAL] Largest Cap显示为M，但原始值应为T级别!")
                    print(f"     原始值: {largest_cap:,.2f} (应该是万亿级别)")
                    print(f"     显示为: {formatted_largest} (错误显示为百万级别)")
                
                # 分析可能的原因
                print(f"\n5. 可能的原因分析")
                print("-" * 80)
                
                print(f"   A. 后端单位转换问题:")
                print(f"      - Finnhub原始单位: 百万美元")
                print(f"      - 需要乘以: 1,000,000")
                print(f"      - 如果忘记乘，3.73T会变成3.73M")
                
                print(f"\n   B. 前端格式化函数问题:")
                print(f"      - formatMarketCap函数逻辑错误")
                print(f"      - 阈值判断错误 (1e12, 1e9, 1e6)")
                print(f"      - 小数位数格式化错误")
                
                print(f"\n   C. 数据链路问题:")
                print(f"      - 后端转换正确，但前端接收错误")
                print(f"      - 数据类型转换问题")
                print(f"      - 缓存了错误的数据")
                
                # 6. 测试Finnhub原始数据
                print(f"\n6. 测试Finnhub原始数据")
                print("-" * 80)
                
                test_symbols = ["AAPL", "MSFT", "NVDA", "GOOGL"]
                for symbol in test_symbols:
                    test_finnhub_raw_data(symbol)
                
        else:
            print(f"[ERROR] 请求失败: {response.status_code}")
            print(f"   响应: {response.text[:500]}")
            
    except Exception as e:
        print(f"[ERROR] 请求异常: {str(e)}")

def format_marketcap(value):
    """模拟前端formatMarketCap函数"""
    if value is None or value == 0:
        return "--"
    
    try:
        num = float(value)
        
        # 万亿 (Trillion) - 1万亿 = 1e12
        if num >= 1e12:
            trillions = num / 1e12
            if trillions >= 100:
                return f"${trillions:.0f}T"
            elif trillions >= 10:
                return f"${trillions:.1f}T"
            else:
                return f"${trillions:.2f}T"
        
        # 十亿 (Billion) - 10亿 = 1e9
        if num >= 1e9:
            billions = num / 1e9
            if billions >= 100:
                return f"${billions:.0f}B"
            elif billions >= 10:
                return f"${billions:.1f}B"
            else:
                return f"${billions:.2f}B"
        
        # 百万 (Million) - 1百万 = 1e6
        if num >= 1e6:
            millions = num / 1e6
            if millions >= 10:
                return f"${millions:.0f}M"
            else:
                return f"${millions:.1f}M"
        
        # 其他
        return f"${num:,.2f}"
        
    except:
        return "--"

def test_finnhub_raw_data(symbol):
    """测试Finnhub原始数据"""
    try:
        import requests
        
        FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
        FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'
        
        # 获取profile数据（包含marketCapitalization）
        profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
        profile_params = {
            'symbol': symbol,
            'token': FINNHUB_API_KEY
        }
        
        response = requests.get(profile_url, params=profile_params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            marketcap_raw = data.get('marketCapitalization')
            
            if marketcap_raw:
                # Finnhub原始单位是百万美元
                converted = marketcap_raw * 1000000
                
                print(f"   {symbol}:")
                print(f"      Finnhub原始值: {marketcap_raw:,.2f} (百万美元)")
                print(f"      转换后值: {converted:,.2f} (美元)")
                print(f"      应该显示为: {format_marketcap_simple(converted)}")
            else:
                print(f"   {symbol}: 未找到marketCapitalization字段")
        else:
            print(f"   {symbol}: API请求失败 ({response.status_code})")
            
    except Exception as e:
        print(f"   {symbol}: 测试失败 - {str(e)}")

def format_marketcap_simple(value):
    """简化版格式化函数"""
    if value >= 1e12:
        return f"${value/1e12:.2f}T"
    elif value >= 1e9:
        return f"${value/1e9:.2f}B"
    elif value >= 1e6:
        return f"${value/1e6:.2f}M"
    else:
        return f"${value:,.2f}"

if __name__ == "__main__":
    debug_marketcap_chain()