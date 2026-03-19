#!/usr/bin/env python3
"""
检查TSM的currency问题
"""

import requests
import json

def test_currency_issue():
    """检查TSM的currency问题"""
    print("检查TSM的currency和单位问题")
    print("=" * 60)
    
    FINNHUB_API_KEY = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"
    FINNHUB_BASE_URL = "https://finnhub.io/api/v1"
    
    # 测试多个股票
    test_symbols = ['TSM', 'AAPL', 'NVDA', 'MSFT', 'AMZN', '2330.TW']
    
    for symbol in test_symbols:
        try:
            print(f"\n测试 {symbol}:")
            print("-" * 40)
            
            # 获取profile数据
            profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
            profile_params = {'symbol': symbol, 'token': FINNHUB_API_KEY}
            
            response = requests.get(profile_url, params=profile_params, timeout=10)
            profile_data = response.json()
            
            print(f"  Name: {profile_data.get('name')}")
            print(f"  Ticker: {profile_data.get('ticker')}")
            print(f"  Exchange: {profile_data.get('exchange')}")
            print(f"  Currency: {profile_data.get('currency')}")
            print(f"  Market Capitalization: {profile_data.get('marketCapitalization')}")
            
            # 分析
            market_cap_raw = profile_data.get('marketCapitalization')
            currency = profile_data.get('currency', 'USD')
            
            if market_cap_raw:
                # 如果是TWD（新台币），需要转换
                if currency == 'TWD':
                    print(f"  [注意] 货币是TWD（新台币）!")
                    print(f"  新台币兑美元汇率约: 1 USD ≈ 30 TWD")
                    
                    # 转换为美元
                    market_cap_usd_twd = market_cap_raw * 1_000_000 / 30  # 百万TWD → 美元
                    market_cap_trillion_twd = market_cap_usd_twd / 1_000_000_000_000
                    
                    print(f"  转换后 (TWD→USD):")
                    print(f"    原始值 (百万TWD): {market_cap_raw}")
                    print(f"    转换为美元: ${market_cap_usd_twd:,.0f}")
                    print(f"    万亿美元: ${market_cap_trillion_twd:.2f}T")
                    
                    # 检查是否合理
                    if 0.3 < market_cap_trillion_twd < 1.0:
                        print(f"  [合理] ${market_cap_trillion_twd:.2f}T 在合理范围内")
                    else:
                        print(f"  [不合理] ${market_cap_trillion_twd:.2f}T 仍然异常")
                
                # 正常转换（假设是百万美元）
                market_cap_usd = market_cap_raw * 1_000_000
                market_cap_trillion = market_cap_usd / 1_000_000_000_000
                
                print(f"  正常转换 (假设百万USD):")
                print(f"    万亿美元: ${market_cap_trillion:.2f}T")
                
                # 检查是否合理
                if symbol == 'TSM':
                    if market_cap_trillion > 10:
                        print(f"  [问题] TSM ${market_cap_trillion:.2f}T 明显过高!")
                    else:
                        print(f"  [正常] TSM ${market_cap_trillion:.2f}T 合理")
                else:
                    if 0.1 < market_cap_trillion < 10:
                        print(f"  [正常] ${market_cap_trillion:.2f}T 合理")
                    else:
                        print(f"  [问题] ${market_cap_trillion:.2f}T 异常")
            
        except Exception as e:
            print(f"  测试{symbol}异常: {str(e)}")
    
    # 结论
    print(f"\n结论分析:")
    print("-" * 40)
    print(f"1. TSM的currency是TWD（新台币）")
    print(f"2. Finnhub的marketCapitalization对TSM可能是百万新台币")
    print(f"3. 需要根据currency进行不同转换")
    print(f"4. 当前代码对所有股票都按百万美元转换，导致TSM错误")
    
    print(f"\n解决方案:")
    print(f"1. 检查currency字段")
    print(f"2. 如果是TWD，需要除以汇率（约30）")
    print(f"3. 或者，对于非USD货币，不转换或使用不同逻辑")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    test_currency_issue()