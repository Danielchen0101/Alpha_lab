#!/usr/bin/env python3
"""
直接测试market cap转换
"""

import requests
import json

def test_marketcap_direct():
    """直接测试market cap"""
    print("直接测试market cap转换")
    print("=" * 80)
    
    # 测试单个股票
    symbols = ["AAPL", "MSFT", "NVDA"]
    
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
                    elif marketcap >= 1e9:
                        unit = "Billion (B)"
                        formatted = f"${marketcap/1e9:.2f}B"
                    elif marketcap >= 1e6:
                        unit = "Million (M)"
                        formatted = f"${marketcap/1e6:.2f}M"
                    else:
                        unit = "Small"
                        formatted = f"${marketcap:,.2f}"
                    
                    print(f"   单位判断: {unit}")
                    print(f"   应该显示: {formatted}")
                    
                    # 检查是否正确
                    if symbol in ["AAPL", "MSFT", "NVDA"] and marketcap < 1e12:
                        print(f"   ❌ 错误: {symbol}的market cap应该大于1万亿，但实际是{marketcap:,.0f}")
                    elif symbol in ["AAPL", "MSFT", "NVDA"] and marketcap >= 1e12:
                        print(f"   ✅ 正确: {symbol}的market cap是{marketcap:,.0f}，应该显示为T级别")
                else:
                    print(f"   ⚠️  marketCap为None")
            else:
                print(f"   ❌ API请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"   ❌ 测试失败: {str(e)}")
    
    print("\n" + "=" * 80)
    print("总结:")
    print("如果显示为M级别，说明后端没有正确乘以1,000,000")
    print("如果显示为T级别，说明修复成功")

if __name__ == "__main__":
    test_marketcap_direct()