import requests

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

# 测试Finnhub搜索API
symbol = 'AAPL'
url = f"{FINNHUB_BASE_URL}/search"
params = {
    'q': symbol,
    'token': FINNHUB_API_KEY
}

print(f"测试Finnhub搜索API: {symbol}")
try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"结果数量: {data.get('count', 0)}")
        
        results = data.get('result', [])
        if results:
            print("前5个结果:")
            for i, result in enumerate(results[:5]):
                print(f"  {i+1}. {result.get('symbol')} - {result.get('description')}")
        else:
            print("无搜索结果")
    else:
        print(f"响应: {response.text[:200]}")
        
except Exception as e:
    print(f"错误: {e}")