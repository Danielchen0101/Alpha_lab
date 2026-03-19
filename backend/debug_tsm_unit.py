#!/usr/bin/env python3
"""
调试TSM的单位问题
"""

import requests
import json

def debug_tsm_unit():
    """调试TSM的单位问题"""
    print("调试TSM的marketCapitalization单位问题")
    print("=" * 60)
    
    FINNHUB_API_KEY = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"
    FINNHUB_BASE_URL = "https://finnhub.io/api/v1"
    
    symbol = "TSM"
    
    try:
        # 获取profile数据
        profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
        profile_params = {'symbol': symbol, 'token': FINNHUB_API_KEY}
        
        response = requests.get(profile_url, params=profile_params, timeout=10)
        profile_data = response.json()
        
        market_cap_raw = profile_data.get('marketCapitalization')
        currency = profile_data.get('currency', 'USD')
        
        print(f"TSM原始数据:")
        print(f"  Market Capitalization: {market_cap_raw}")
        print(f"  Currency: {currency}")
        print(f"  Name: {profile_data.get('name')}")
        print(f"  Exchange: {profile_data.get('exchange')}")
        
        print(f"\n不同单位假设测试:")
        print("-" * 40)
        
        # 假设1: 单位是美元（不转换）
        print(f"\n假设1: 单位是美元（不转换）")
        market_cap_usd_1 = market_cap_raw
        market_cap_trillion_1 = market_cap_usd_1 / 1_000_000_000_000
        print(f"  市值: ${market_cap_trillion_1:.4f}T")
        print(f"  评价: {'合理' if 0.5 < market_cap_trillion_1 < 0.7 else '不合理'}")
        
        # 假设2: 单位是千美元
        print(f"\n假设2: 单位是千美元（×1,000）")
        market_cap_usd_2 = market_cap_raw * 1_000
        market_cap_trillion_2 = market_cap_usd_2 / 1_000_000_000_000
        print(f"  市值: ${market_cap_trillion_2:.2f}T")
        print(f"  评价: {'合理' if 0.5 < market_cap_trillion_2 < 0.7 else '不合理'}")
        
        # 假设3: 单位是百万美元（当前代码假设）
        print(f"\n假设3: 单位是百万美元（当前代码假设）")
        market_cap_usd_3 = market_cap_raw * 1_000_000
        market_cap_trillion_3 = market_cap_usd_3 / 1_000_000_000_000
        print(f"  市值: ${market_cap_trillion_3:.2f}T")
        print(f"  评价: {'合理' if 0.5 < market_cap_trillion_3 < 0.7 else '不合理'}")
        
        # 假设4: 单位是百万新台币，需要汇率转换
        print(f"\n假设4: 单位是百万新台币（TWD）")
        exchange_rate = 30  # 1 USD ≈ 30 TWD
        market_cap_usd_4 = (market_cap_raw * 1_000_000) / exchange_rate
        market_cap_trillion_4 = market_cap_usd_4 / 1_000_000_000_000
        print(f"  汇率: 1 USD = {exchange_rate} TWD")
        print(f"  市值: ${market_cap_trillion_4:.2f}T")
        print(f"  评价: {'合理' if 0.5 < market_cap_trillion_4 < 0.7 else '不合理'}")
        
        # 假设5: 单位是新台币（不乘以百万）
        print(f"\n假设5: 单位是新台币（TWD）")
        market_cap_usd_5 = market_cap_raw / exchange_rate
        market_cap_trillion_5 = market_cap_usd_5 / 1_000_000_000_000
        print(f"  市值: ${market_cap_trillion_5:.6f}T")
        print(f"  评价: {'合理' if 0.5 < market_cap_trillion_5 < 0.7 else '不合理'}")
        
        # 实际TSM市值计算（根据股价和股本）
        print(f"\n实际TSM市值估算:")
        print("-" * 40)
        
        # 获取quote数据
        quote_url = f"{FINNHUB_BASE_URL}/quote"
        quote_params = {'symbol': symbol, 'token': FINNHUB_API_KEY}
        quote_response = requests.get(quote_url, params=quote_params, timeout=5)
        quote_data = quote_response.json()
        
        price = quote_data.get('c', 0)
        print(f"  当前股价: ${price:.2f}")
        
        # TSM总股本约52.6亿股（来源: 公开数据）
        shares_outstanding = 5.26 * 1_000_000_000  # 52.6亿股
        print(f"  总股本: {shares_outstanding:,.0f} 股")
        
        market_cap_actual = price * shares_outstanding
        market_cap_trillion_actual = market_cap_actual / 1_000_000_000_000
        print(f"  计算市值: ${market_cap_actual:,.0f}")
        print(f"  计算市值: ${market_cap_trillion_actual:.2f}T")
        
        # 与Finnhub数据对比
        print(f"\n与Finnhub数据对比:")
        print(f"  Finnhub原始值: {market_cap_raw}")
        print(f"  实际市值: ${market_cap_trillion_actual:.2f}T")
        
        # 找出正确转换
        print(f"\n找出正确转换:")
        for multiplier in [1, 1_000, 1_000_000, 1_000_000_000]:
            for divider in [1, 30]:  # 1表示USD，30表示TWD汇率
                test_value = (market_cap_raw * multiplier) / divider
                test_trillion = test_value / 1_000_000_000_000
                
                if abs(test_trillion - market_cap_trillion_actual) < 0.1:  # 误差小于0.1T
                    print(f"  可能转换: ×{multiplier} / {divider}")
                    print(f"    得到: ${test_trillion:.2f}T")
                    print(f"    实际: ${market_cap_trillion_actual:.2f}T")
                    print(f"    误差: {abs(test_trillion - market_cap_trillion_actual):.3f}T")
        
        # 结论
        print(f"\n结论:")
        print(f"1. TSM的marketCapitalization可能是新台币（不是百万单位）")
        print(f"2. 需要除以汇率（约30）得到美元")
        print(f"3. 当前代码对所有股票都×1,000,000，对TSM是错误的")
        
        print(f"\n建议修复:")
        print(f"1. 检查currency字段")
        print(f"2. 如果是TWD，不乘以1,000,000，而是除以汇率")
        print(f"3. 或者，对于非USD货币，跳过market cap计算")
        
    except Exception as e:
        print(f"调试异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    debug_tsm_unit()