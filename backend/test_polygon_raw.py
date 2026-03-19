import requests
import json
from datetime import datetime, timedelta

print("=== 测试Polygon API原始数据 ===")

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

# 测试1: Ticker Details
print("\n1. 测试 /v3/reference/tickers/AAPL:")
ticker_details = make_request("/v3/reference/tickers/AAPL")
if "results" in ticker_details:
    print("返回字段:")
    for key, value in ticker_details["results"].items():
        print(f"  {key}: {value}")
else:
    print(f"错误: {ticker_details.get('error', '未知错误')}")

# 测试2: Aggregates (当日数据)
print("\n2. 测试 /v2/aggs/ticker/AAPL/range/1/day (当日):")
today = datetime.now().strftime("%Y-%m-%d")
yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
aggregates = make_request(f"/v2/aggs/ticker/AAPL/range/1/day/{yesterday}/{today}")
if "results" in aggregates and aggregates["results"]:
    print("返回字段 (第一个结果):")
    for key, value in aggregates["results"][0].items():
        print(f"  {key}: {value}")
else:
    print(f"错误或空结果: {aggregates.get('error', '未知错误')}")

# 测试3: Previous Close
print("\n3. 测试 /v2/aggs/ticker/AAPL/prev (前收盘):")
prev_close = make_request("/v2/aggs/ticker/AAPL/prev")
if "results" in prev_close and prev_close["results"]:
    print("返回字段 (第一个结果):")
    for key, value in prev_close["results"][0].items():
        print(f"  {key}: {value}")
else:
    print(f"错误或空结果: {prev_close.get('error', '未知错误')}")

# 测试4: Snapshot (所有数据一次性获取)
print("\n4. 测试 /v2/snapshot/locale/us/markets/stocks/tickers/AAPL (快照):")
snapshot = make_request("/v2/snapshot/locale/us/markets/stocks/tickers/AAPL")
if "ticker" in snapshot:
    print("返回字段:")
    ticker_data = snapshot["ticker"]
    for key, value in ticker_data.items():
        if isinstance(value, dict):
            print(f"  {key}: [对象]")
            for sub_key, sub_value in value.items():
                print(f"    {sub_key}: {sub_value}")
        else:
            print(f"  {key}: {value}")
else:
    print(f"错误: {snapshot.get('error', '未知错误')}")

print("\n=== 分析结果 ===")
print("1. 检查哪些字段是Polygon API实际返回的")
print("2. 检查后端是否正确映射这些字段")
print("3. 确定哪些字段需要不同的API端点")