#!/usr/bin/env python3
"""
单独测试TSM的Finnhub API返回
"""

import requests
import json

def test_tsm_api():
    """测试TSM API返回"""
    print("测试TSM的Finnhub API返回")
    print("=" * 60)
    
    FINNHUB_API_KEY = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"
    FINNHUB_BASE_URL = "https://finnhub.io/api/v1"
    
    symbol = "TSM"
    
    try:
        # 1. 获取quote数据
        print(f"\n1. 获取TSM quote数据")
        print("-" * 40)
        
        quote_url = f"{FINNHUB_BASE_URL}/quote"
        quote_params = {'symbol': symbol, 'token': FINNHUB_API_KEY}
        
        quote_response = requests.get(quote_url, params=quote_params, timeout=10)
        quote_data = quote_response.json()
        
        print(f"  Quote数据:")
        print(f"    Current: {quote_data.get('c')}")
        print(f"    Change: {quote_data.get('d')}")
        print(f"    Change%: {quote_data.get('dp')}")
        print(f"    High: {quote_data.get('h')}")
        print(f"    Low: {quote_data.get('l')}")
        print(f"    Open: {quote_data.get('o')}")
        print(f"    Previous Close: {quote_data.get('pc')}")
        
        # 2. 获取profile数据
        print(f"\n2. 获取TSM profile数据")
        print("-" * 40)
        
        profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
        profile_params = {'symbol': symbol, 'token': FINNHUB_API_KEY}
        
        profile_response = requests.get(profile_url, params=profile_params, timeout=10)
        profile_data = profile_response.json()
        
        print(f"  Profile数据:")
        print(f"    Name: {profile_data.get('name')}")
        print(f"    Ticker: {profile_data.get('ticker')}")
        print(f"    Exchange: {profile_data.get('exchange')}")
        print(f"    Industry: {profile_data.get('finnhubIndustry')}")
        print(f"    Currency: {profile_data.get('currency')}")
        print(f"    Market Capitalization: {profile_data.get('marketCapitalization')}")
        
        # 分析marketCapitalization
        market_cap_raw = profile_data.get('marketCapitalization')
        if market_cap_raw:
            print(f"\n3. Market Capitalization分析")
            print("-" * 40)
            
            print(f"  原始值: {market_cap_raw}")
            print(f"  单位: 百万美元 (Finnhub标准)")
            
            # 转换为不同单位
            market_cap_usd = market_cap_raw * 1_000_000
            market_cap_billion = market_cap_usd / 1_000_000_000
            market_cap_trillion = market_cap_usd / 1_000_000_000_000
            
            print(f"\n  转换后:")
            print(f"    美元: ${market_cap_usd:,.0f}")
            print(f"    十亿美元: ${market_cap_billion:,.2f}B")
            print(f"    万亿美元: ${market_cap_trillion:,.2f}T")
            
            # 检查是否合理
            print(f"\n  合理性检查:")
            print(f"    TSM当前价格: ${quote_data.get('c', 0):.2f}")
            print(f"    TSM实际市值应约: $500-600B (0.5-0.6T)")
            print(f"    我们得到: ${market_cap_trillion:.2f}T")
            
            if market_cap_trillion > 10:
                print(f"    [严重问题] 市值${market_cap_trillion:.2f}T明显过高!")
                print(f"    可能原因:")
                print(f"    1. Finnhub数据错误")
                print(f"    2. 单位不是百万美元")
                print(f"    3. 需要除以1,000,000而不是乘以")
                
                # 测试不同转换
                print(f"\n    测试不同转换:")
                print(f"    原始值: {market_cap_raw}")
                print(f"    如果单位是美元 (不转换): ${market_cap_raw / 1_000_000_000_000:.2f}T")
                print(f"    如果单位是千美元 (×1,000): ${market_cap_raw * 1000 / 1_000_000_000_000:.2f}T")
                print(f"    如果单位是百万美元 (×1,000,000): ${market_cap_trillion:.2f}T")
                print(f"    如果单位是十亿美元 (×1,000,000,000): ${market_cap_raw * 1_000_000_000 / 1_000_000_000_000:.2f}T")
            else:
                print(f"    [正常] 市值${market_cap_trillion:.2f}T在合理范围内")
        
        # 3. 对比其他股票
        print(f"\n4. 对比其他股票")
        print("-" * 40)
        
        test_symbols = ['AAPL', 'NVDA', 'MSFT', 'AMZN']
        for test_symbol in test_symbols:
            try:
                profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
                profile_params = {'symbol': test_symbol, 'token': FINNHUB_API_KEY}
                
                response = requests.get(profile_url, params=profile_params, timeout=5)
                data = response.json()
                
                market_cap_raw = data.get('marketCapitalization')
                if market_cap_raw:
                    market_cap_usd = market_cap_raw * 1_000_000
                    market_cap_trillion = market_cap_usd / 1_000_000_000_000
                    
                    print(f"  {test_symbol}:")
                    print(f"    原始值: {market_cap_raw}")
                    print(f"    转换后: ${market_cap_trillion:.2f}T")
                    print(f"    是否合理: {'是' if 0.1 < market_cap_trillion < 10 else '否'}")
            except:
                print(f"  {test_symbol}: 获取失败")
        
        # 4. 结论
        print(f"\n5. 结论")
        print("-" * 40)
        
        if market_cap_raw:
            if market_cap_raw > 10000000:  # 如果原始值超过100亿
                print(f"  [结论] TSM的marketCapitalization原始值异常大")
                print(f"         可能Finnhub对TSM使用了不同单位")
                print(f"         建议: 不转换或使用不同转换因子")
            else:
                print(f"  [结论] 转换逻辑正确，但TSM数据源有问题")
        else:
            print(f"  [结论] 无法获取TSM的marketCapitalization")
            
    except Exception as e:
        print(f"  测试异常: {str(e)}")
        import traceback
        traceback.print_exc()
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    test_tsm_api()