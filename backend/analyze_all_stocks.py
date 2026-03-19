#!/usr/bin/env python3
"""
分析所有股票的currency和marketCapitalization原始值
"""

import requests
import json
import time

def analyze_all_stocks():
    """分析所有股票"""
    print("分析所有股票的currency和marketCapitalization")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 获取Dashboard数据
        timestamp = int(time.time() * 1000)
        response = requests.get(f"{base_url}/market/stocks?dashboard=true&_={timestamp}", timeout=20)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"分析 {len(stocks)} 支股票:")
            print("-" * 80)
            print(f"{'Symbol':<8} {'Currency':<10} {'MarketCap原始值':<25} {'转换后(T)':<12} {'状态':<15}")
            print("-" * 80)
            
            # 收集统计信息
            usd_stocks = []
            non_usd_stocks = []
            suspicious_stocks = []
            
            for stock in stocks:
                symbol = stock.get('symbol', 'N/A')
                currency = stock.get('currency', 'USD')
                market_cap_raw = stock.get('marketCap')
                
                if market_cap_raw:
                    # 转换为万亿
                    market_cap_trillion = market_cap_raw / 1_000_000_000_000
                    
                    # 判断状态
                    status = "正常"
                    if currency != 'USD':
                        status = f"非USD ({currency})"
                        non_usd_stocks.append(symbol)
                    elif market_cap_trillion > 10:  # 超过10T可疑
                        status = "异常(>10T)"
                        suspicious_stocks.append(symbol)
                    elif market_cap_trillion < 0.01:  # 小于10B可疑
                        status = "异常(<10B)"
                        suspicious_stocks.append(symbol)
                    else:
                        usd_stocks.append(symbol)
                    
                    print(f"{symbol:<8} {currency:<10} {market_cap_raw:<25} ${market_cap_trillion:<11.2f}T {status:<15}")
                else:
                    print(f"{symbol:<8} {currency:<10} {'N/A':<25} {'N/A':<12} 无数据")
            
            # 分析结果
            print(f"\n分析结果:")
            print("-" * 80)
            print(f"USD货币股票 ({len(usd_stocks)}支): {', '.join(usd_stocks)}")
            print(f"非USD货币股票 ({len(non_usd_stocks)}支): {', '.join(non_usd_stocks)}")
            print(f"可疑市值股票 ({len(suspicious_stocks)}支): {', '.join(suspicious_stocks)}")
            
            # 检查marketCap原始值的分布
            print(f"\nmarketCap原始值分析:")
            print("-" * 80)
            
            market_caps = [s.get('marketCap') for s in stocks if s.get('marketCap')]
            if market_caps:
                avg = sum(market_caps) / len(market_caps)
                min_val = min(market_caps)
                max_val = max(market_caps)
                
                print(f"  平均值: {avg:.2f}")
                print(f"  最小值: {min_val:.2f}")
                print(f"  最大值: {max_val:.2f}")
                print(f"  范围: {max_val/min_val:.0f}倍")
                
                # 检查异常值
                print(f"\n  异常值检测:")
                q1 = sorted(market_caps)[len(market_caps)//4]
                q3 = sorted(market_caps)[3*len(market_caps)//4]
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                
                outliers = [cap for cap in market_caps if cap < lower_bound or cap > upper_bound]
                print(f"  异常值数量: {len(outliers)}")
                
                for cap in outliers:
                    # 找出对应的股票
                    for stock in stocks:
                        if stock.get('marketCap') == cap:
                            cap_trillion = cap / 1_000_000_000_000
                            print(f"    {stock.get('symbol')}: ${cap_trillion:.2f}T (原始值: {cap})")
            
            # 建议的修复策略
            print(f"\n建议的修复策略:")
            print("-" * 80)
            print(f"1. 只对currency='USD'的股票应用正常转换")
            print(f"2. 对非USD货币的股票，marketCap设为None")
            print(f"3. 对明显异常的USD股票（如>10T），也设为None")
            print(f"4. 在计算Largest Cap和Total Market Cap时排除None值")
            
        else:
            print(f"请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"分析异常: {str(e)}")
    
    print(f"\n" + "=" * 80)

if __name__ == "__main__":
    analyze_all_stocks()