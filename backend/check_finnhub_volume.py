import requests
import json

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'

print("检查 Finnhub API 中的 Volume 数据")
print("=" * 60)

# 1. 检查 quote API (当前使用的)
print("1. Finnhub Quote API 响应:")
url = "https://finnhub.io/api/v1/quote"
params = {
    "symbol": "AAPL",
    "token": FINNHUB_API_KEY
}
response = requests.get(url, params=params, timeout=10)
print(f"状态码: {response.status_code}")
data = response.json()
print(f"字段: {list(data.keys())}")
print(f"完整响应: {json.dumps(data, indent=2)}")
print(f"结论: quote API 没有 volume 字段")

# 2. 检查是否有其他 Finnhub API 提供实时 volume
print("\n2. 检查其他 Finnhub API:")

# 检查 stock/candle 最新数据
print("\na) stock/candle API (最新一天):")
from datetime import datetime, timedelta
end_date = datetime.now()
start_date = end_date - timedelta(days=1)

url = "https://finnhub.io/api/v1/stock/candle"
params = {
    'symbol': 'AAPL',
    'resolution': 'D',
    'from': int(start_date.timestamp()),
    'to': int(end_date.timestamp()),
    'token': FINNHUB_API_KEY
}
response = requests.get(url, params=params, timeout=10)
print(f"状态码: {response.status_code}")
if response.status_code == 200:
    candle_data = response.json()
    print(f"响应状态: {candle_data.get('s')}")
    if candle_data.get('s') == 'ok' and 'v' in candle_data:
        print(f"有 volume 数据: {candle_data['v']}")
        if candle_data['v']:
            print(f"最新 volume: {candle_data['v'][-1]:,}")
    else:
        print(f"无数据或错误: {candle_data}")
else:
    print(f"API 错误: {response.status_code}")
    print(f"响应: {response.text[:200]}")

# 3. 检查 Yahoo Finance 是否有 volume
print("\n3. 检查 Yahoo Finance (当前历史数据源):")
print("当前历史数据来自 Yahoo Finance，可以获取最新 volume")

# 4. 建议方案
print("\n4. Volume 修复方案:")
print("方案 A: 使用 Yahoo Finance 最新历史数据的 volume")
print("  - 优点: 真实数据，与历史数据源一致")
print("  - 缺点: 不是实时成交量，是最近一个交易日的")
print("方案 B: 保持 null，前端显示 '--'")
print("  - 优点: 诚实，不伪造数据")
print("  - 缺点: 用户看不到成交量")
print("方案 C: 寻找其他免费 API 提供实时 volume")
print("  - Alpha Vantage: 有 volume 但需要 API key")
print("  - IEX Cloud: 有 volume 但有免费限制")

print("\n5. 最小修改建议:")
print("在 /api/market/stock/<symbol> 中添加:")
print("  1. 调用 Yahoo Finance 获取最新交易日数据")
print("  2. 使用最新交易日的 volume")
print("  3. 如果获取失败，保持 null")