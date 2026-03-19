"""
测试Finnhub返回的marketCap单位
"""

import requests
import json

def test_finnhub_marketcap():
    """测试Finnhub marketCap单位"""
    print("=" * 60)
    print("测试Finnhub marketCap单位")
    print("=" * 60)
    
    api_key = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"
    base_url = "https://finnhub.io/api/v1"
    symbol = "AAPL"
    
    # 测试profile2端点（包含marketCap）
    endpoint = "/stock/profile2"
    params = {
        "symbol": symbol,
        "token": api_key
    }
    
    try:
        response = requests.get(f"{base_url}{endpoint}", params=params, timeout=10)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"\nAAPL公司简介数据:")
            print(f"公司名称: {data.get('name')}")
            print(f"市值(marketCapitalization): {data.get('marketCapitalization')}")
            print(f"货币: {data.get('currency')}")
            print(f"交易所: {data.get('exchange')}")
            print(f"完整数据: {json.dumps(data, indent=2)}")
            
            # 检查是否有其他相关字段
            print(f"\n所有字段:")
            for key, value in data.items():
                if 'cap' in key.lower() or 'value' in key.lower():
                    print(f"  {key}: {value}")
        else:
            print(f"错误: {response.text}")
            
    except Exception as e:
        print(f"异常: {type(e).__name__}: {str(e)}")
    
    print(f"\n{'='*60}")
    print("测试完成")
    print(f"{'='*60}")

if __name__ == "__main__":
    test_finnhub_marketcap()