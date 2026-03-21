import requests
import json

# 测试Finnhub API是否工作
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'

# 测试quote API
quote_url = "https://finnhub.io/api/v1/quote"
params = {
    'symbol': 'AAPL',
    'token': FINNHUB_API_KEY
}

print("测试Finnhub Quote API...")
print(f"URL: {quote_url}")
print(f"参数: {params}")

try:
    response = requests.get(quote_url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"响应: {data}")
        
        # 检查是否有错误
        if 'error' in data:
            print(f"❌ Finnhub返回错误: {data['error']}")
        else:
            print(f"✅ Finnhub Quote API工作正常")
            print(f"  当前价格: {data.get('c', 'N/A')}")
            print(f"  前收盘价: {data.get('pc', 'N/A')}")
    elif response.status_code == 429:
        print(f"❌ Finnhub API限制: 429 Too Many Requests")
    elif response.status_code == 403:
        print(f"❌ Finnhub API密钥无效: 403 Forbidden")
    else:
        print(f"❌ Finnhub请求失败: {response.status_code}")
        print(f"响应: {response.text[:200]}")
        
except Exception as e:
    print(f"❌ 测试失败: {e}")

# 测试profile API
print(f"\n\n测试Finnhub Profile API...")
profile_url = "https://finnhub.io/api/v1/stock/profile2"
params = {
    'symbol': 'AAPL',
    'token': FINNHUB_API_KEY
}

try:
    response = requests.get(profile_url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"响应键: {list(data.keys())}")
        
        if 'error' in data:
            print(f"❌ Finnhub返回错误: {data['error']}")
        else:
            print(f"✅ Finnhub Profile API工作正常")
            print(f"  公司名称: {data.get('name', 'N/A')}")
            print(f"  市值: {data.get('marketCapitalization', 'N/A')}M")
            print(f"  流通股: {data.get('shareOutstanding', 'N/A')}")
    elif response.status_code == 429:
        print(f"❌ Finnhub API限制: 429 Too Many Requests")
    elif response.status_code == 403:
        print(f"❌ Finnhub API密钥无效: 403 Forbidden")
    else:
        print(f"❌ Finnhub请求失败: {response.status_code}")
        print(f"响应: {response.text[:200]}")
        
except Exception as e:
    print(f"❌ 测试失败: {e}")