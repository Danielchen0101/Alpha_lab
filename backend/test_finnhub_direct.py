#!/usr/bin/env python3
"""
直接测试Finnhub API
"""

import requests
import json

def test_finnhub_direct():
    """直接测试Finnhub API"""
    print("直接测试Finnhub API")
    print("=" * 60)
    
    # Finnhub API配置（从代码中获取）
    FINNHUB_API_KEY = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"
    FINNHUB_BASE_URL = "https://finnhub.io/api/v1"
    
    try:
        # 直接调用Finnhub quote API
        symbol = 'AAPL'
        quote_url = f"{FINNHUB_BASE_URL}/quote"
        quote_params = {
            'symbol': symbol,
            'token': FINNHUB_API_KEY
        }
        
        print(f"调用Finnhub quote API: {symbol}")
        response = requests.get(quote_url, params=quote_params, timeout=10)
        
        if response.status_code == 200:
            quote_data = response.json()
            print(f"Finnhub API返回的原始数据:")
            print(json.dumps(quote_data, indent=2))
            
            print(f"\n字段分析:")
            print(f"  c (current price): {quote_data.get('c')}")
            print(f"  h (high): {quote_data.get('h')}")
            print(f"  l (low): {quote_data.get('l')}")
            print(f"  o (open): {quote_data.get('o')}")
            print(f"  pc (previous close): {quote_data.get('pc')}")
            print(f"  t (timestamp): {quote_data.get('t')}")
            
            # 检查是否有h/l字段
            if 'h' in quote_data:
                print(f"  ✅ 有'h'字段: {quote_data['h']}")
            else:
                print(f"  ❌ 没有'h'字段")
                
            if 'l' in quote_data:
                print(f"  ✅ 有'l'字段: {quote_data['l']}")
            else:
                print(f"  ❌ 没有'l'字段")
            
            # 检查值是否为0或null
            h_value = quote_data.get('h')
            l_value = quote_data.get('l')
            
            if h_value is None:
                print(f"  ⚠️  'h'字段为None")
            elif h_value == 0:
                print(f"  ⚠️  'h'字段为0")
            else:
                print(f"  ✅ 'h'字段有有效值: {h_value}")
                
            if l_value is None:
                print(f"  ⚠️  'l'字段为None")
            elif l_value == 0:
                print(f"  ⚠️  'l'字段为0")
            else:
                print(f"  ✅ 'l'字段有有效值: {l_value}")
        
        else:
            print(f"Finnhub API调用失败: {response.status_code}")
            print(f"响应: {response.text}")
            
    except Exception as e:
        print(f"测试异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    test_finnhub_direct()