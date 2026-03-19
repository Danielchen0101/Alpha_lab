#!/usr/bin/env python3
"""
测试TSM转换逻辑
"""

def test_tsm_conversion():
    """测试TSM转换逻辑"""
    print("测试TSM的market cap转换逻辑")
    print("=" * 60)
    
    # TSM的原始数据
    symbol_upper = 'TSM'
    market_cap_raw = 48493818.828125  # 这是我们从API获取的值
    currency = 'USD'
    
    print(f"TSM原始数据:")
    print(f"  market_cap_raw: {market_cap_raw}")
    print(f"  currency: {currency}")
    
    # 应用智能检测逻辑
    is_reasonable_usd = (
        currency == 'USD' and 
        1000 <= market_cap_raw <= 10_000_000
    )
    
    print(f"\n智能检测结果:")
    print(f"  currency == 'USD': {currency == 'USD'}")
    print(f"  1000 <= market_cap_raw <= 10_000_000: {1000 <= market_cap_raw <= 10_000_000}")
    print(f"  is_reasonable_usd: {is_reasonable_usd}")
    
    if is_reasonable_usd:
        # 正常USD股票：百万美元 → 美元
        market_cap = market_cap_raw * 1000000
        print(f"\n[正常转换] {symbol_upper}: {market_cap_raw:.2f} → {market_cap}")
        cap_trillion = market_cap / 1_000_000_000_000
        print(f"  转换后: ${cap_trillion:.2f}T")
    else:
        # 异常情况
        market_cap = None
        reason = []
        if currency != 'USD':
            reason.append(f"currency={currency}")
        if market_cap_raw < 1000:
            reason.append(f"值过小({market_cap_raw:.2f})")
        if market_cap_raw > 10_000_000:
            reason.append(f"值过大({market_cap_raw:.2f})")
        
        print(f"\n[跳过转换] {symbol_upper}: {', '.join(reason)}")
        print(f"  market_cap将被设为: {market_cap}")
    
    print(f"\n结论:")
    print("-" * 40)
    print(f"TSM的market_cap_raw = {market_cap_raw}")
    print(f"这大于10,000,000，所以应该被跳过")
    print(f"market_cap应该为: None")
    
    # 检查如果错误转换会怎样
    print(f"\n如果错误转换（乘以1,000,000）:")
    wrong_cap = market_cap_raw * 1000000
    wrong_cap_trillion = wrong_cap / 1_000_000_000_000
    print(f"  wrong_cap: {wrong_cap}")
    print(f"  显示为: ${wrong_cap_trillion:.2f}T (这就是我们看到的$48.49T)")

if __name__ == "__main__":
    test_tsm_conversion()