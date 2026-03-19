import requests
import json

FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'

print("检查 Finnhub API 中的 Volume 数据")
print("=" * 60)

# 1. 检查 quote API
print("\n1. Quote API 响应:")
url = "https://finnhub.io/api/v1/quote"
params = {
    "symbol": "AAPL",
    "token": FINNHUB_API_KEY
}
response = requests.get(url, params=params, timeout=10)
quote_data = response.json()
print(f"状态码: {response.status_code}")
print(f"字段: {list(quote_data.keys())}")
print(f"完整响应: {json.dumps(quote_data, indent=2)}")

# 2. 检查是否有其他 API 提供 volume
print("\n" + "=" * 60)
print("2. 检查其他可能提供 volume 的 API:")

# 检查 stock/candle API (可能需要付费)
print("\na) 尝试 stock/candle API (可能 403):")
url = "https://finnhub.io/api/v1/stock/candle"
params = {
    "symbol": "AAPL",
    "resolution": "D",
    "from": 1770768000,  # 2026-02-01
    "to": 1773273600,    # 2026-03-01
    "token": FINNHUB_API_KEY
}
response = requests.get(url, params=params, timeout=10)
print(f"状态码: {response.status_code}")
if response.status_code == 200:
    candle_data = response.json()
    print(f"字段: {list(candle_data.keys())}")
    if 'v' in candle_data:
        print(f"有 volume 数据: {len(candle_data['v'])} 个数据点")
        if candle_data['v']:
            print(f"最新 volume: {candle_data['v'][-1]:,}")
else:
    print(f"响应: {response.text[:200]}")

# 3. 检查是否有实时成交量 API
print("\n" + "=" * 60)
print("3. 检查实时成交量:")

# 根据 Finnhub 文档，实时成交量可能在 quote API 中
print("\nQuote API 字段说明:")
print("c: current price")
print("d: change")
print("dp: percent change")
print("h: high price of the day")
print("l: low price of the day")
print("o: open price of the day")
print("pc: previous close price")
print("t: timestamp")
print("注意: quote API 没有 volume 字段")

# 4. 检查其他免费 API 选项
print("\n" + "=" * 60)
print("4. 替代方案分析:")

print("\na) Alpha Vantage: 有 volume 但需要 API key")
print("b) Yahoo Finance (yfinance): 有 volume 但需要重新集成")
print("c) IEX Cloud: 有 volume 但有免费限制")
print("d) 使用最新历史数据的 volume 作为近似值")

# 5. 建议方案
print("\n" + "=" * 60)
print("5. 建议解决方案:")

print("\n方案 A: 使用最新历史数据的 volume")
print("  - 调用 /stock/candle 获取最近一天的数据")
print("  - 使用最新的 volume 作为当日成交量近似值")
print("  - 问题: 免费 API 可能限制访问")

print("\n方案 B: 使用其他免费 API 作为补充")
print("  - 集成 Alpha Vantage 免费层")
print("  - 每天有限制但足够使用")

print("\n方案 C: 显示 '--' 并说明原因")
print("  - 当前 Finnhub 免费 API 不提供实时成交量")
print("  - 显示 '--' 但添加提示信息")