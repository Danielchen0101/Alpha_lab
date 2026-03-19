"""
测试marketCap单位问题
"""

import requests
import json

def test_marketcap_units():
    """测试marketCap单位"""
    print("=" * 80)
    print("marketCap单位测试")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    
    # 测试Dashboard请求
    print("\n1. 测试Dashboard请求（轻量级模式）:")
    print("-" * 40)
    
    try:
        response = requests.get(
            f"{base_url}/api/market/stocks",
            params={"dashboard": "true"},
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"获取到 {len(stocks)} 只股票数据")
            print(f"数据源: {data.get('source', 'Unknown')}")
            
            # 检查前3只股票的marketCap
            for i, stock in enumerate(stocks[:3]):
                symbol = stock.get('symbol', 'N/A')
                market_cap = stock.get('marketCap')
                
                print(f"\n  {symbol}:")
                print(f"    marketCap原始值: {market_cap}")
                
                if market_cap:
                    # 检查单位
                    if market_cap >= 1e12:
                        unit = "T (万亿)"
                        formatted = f"${market_cap/1e12:.2f}T"
                    elif market_cap >= 1e9:
                        unit = "B (十亿)"
                        formatted = f"${market_cap/1e9:.2f}B"
                    elif market_cap >= 1e6:
                        unit = "M (百万)"
                        formatted = f"${market_cap/1e6:.2f}M"
                    else:
                        unit = "原始"
                        formatted = f"${market_cap}"
                    
                    print(f"    单位判断: {unit}")
                    print(f"    格式化: {formatted}")
                    
                    # 检查是否合理
                    expected_t = {
                        'AAPL': 3.7,  # 万亿
                        'MSFT': 3.0,  # 万亿
                        'GOOGL': 3.8,  # 万亿
                        'NVDA': 4.4,  # 万亿
                    }
                    
                    if symbol in expected_t:
                        expected = expected_t[symbol]
                        actual = market_cap / 1e12
                        if abs(actual - expected) > 0.5:  # 误差超过0.5万亿
                            print(f"    ⚠️  警告: 预期约${expected}T，实际${actual:.2f}T")
                            print(f"      可能单位错误: 实际值太小")
        else:
            print(f"请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"测试异常: {type(e).__name__}: {str(e)}")
    
    # 测试完整模式
    print("\n2. 测试完整模式请求:")
    print("-" * 40)
    
    try:
        response = requests.get(
            f"{base_url}/api/market/stocks",
            timeout=30
        )
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            print(f"获取到 {len(stocks)} 只股票数据")
            
            # 检查是否与轻量级模式相同
            if stocks:
                sample = stocks[0]
                symbol = sample.get('symbol', 'N/A')
                market_cap = sample.get('marketCap')
                print(f"  {symbol} marketCap: {market_cap}")
        else:
            print(f"请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"测试异常: {type(e).__name__}: {str(e)}")
    
    print("\n" + "=" * 80)
    print("测试完成")
    print("=" * 80)

if __name__ == "__main__":
    test_marketcap_units()