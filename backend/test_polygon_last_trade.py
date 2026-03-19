import requests
import json

print("=== 测试Polygon Last Trade API ===")

# Polygon API配置
API_KEY = "Pb17vE12y3eH4ixU_P3or5W89TfFbN7E"
BASE_URL = "https://api.polygon.io"

def make_request(endpoint, params=None):
    """发送请求到Polygon API"""
    try:
        url = f"{BASE_URL}{endpoint}"
        if params is None:
            params = {}
        params["apiKey"] = API_KEY
        
        print(f"\n请求: {endpoint}")
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"状态: {response.status_code}")
            return data
        else:
            print(f"状态: {response.status_code}")
            print(f"错误: {response.text[:200]}")
            return {"error": f"API错误: {response.status_code}"}
    except Exception as e:
        print(f"请求异常: {e}")
        return {"error": f"请求异常: {str(e)}"}

# 测试1: Last Trade
print("\n1. 测试 /v2/last/trade/AAPL (最新交易):")
last_trade = make_request("/v2/last/trade/AAPL")
if "results" in last_trade:
    print("返回字段:")
    for key, value in last_trade["results"].items():
        print(f"  {key}: {value}")
else:
    print(f"错误: {last_trade.get('error', '未知错误')}")

# 测试2: Last Quote
print("\n2. 测试 /v2/last/nbbo/AAPL (最新报价):")
last_quote = make_request("/v2/last/nbbo/AAPL")
if "results" in last_quote:
    print("返回字段:")
    for key, value in last_quote["results"].items():
        print(f"  {key}: {value}")
else:
    print(f"错误: {last_quote.get('error', '未知错误')}")

# 测试3: 检查是否有其他获取sector的端点
print("\n3. 测试 /v3/reference/tickers (搜索):")
search_params = {
    "ticker": "AAPL",
    "active": "true",
    "limit": 1
}
search_ticker = make_request("/v3/reference/tickers", search_params)
if "results" in search_ticker and search_ticker["results"]:
    print("返回字段 (第一个结果):")
    result = search_ticker["results"][0]
    for key, value in result.items():
        if key in ["ticker", "name", "market_cap", "sector", "industry"]:
            print(f"  {key}: {value}")
else:
    print(f"错误: {search_ticker.get('error', '未知错误')}")

print("\n=== 分析 ===")
print("问题1: 当前后端使用 /v2/aggs/ticker/{symbol}/range/1/day 获取当日数据")
print("  但非交易日可能返回空结果")
print("问题2: Ticker Details端点不返回sector字段")
print("问题3: 需要找到正确的API端点获取实时价格和涨跌幅")