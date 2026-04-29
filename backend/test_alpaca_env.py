#!/usr/bin/env python3
"""
测试 .env 文件中的 Alpaca API 密钥是否有效
"""
import os
import sys
import requests

# 添加当前目录到 Python 路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from config import ALPACA_API_KEY, ALPACA_API_SECRET, ALPACA_BASE_URL
    print(f"从 config 导入 Alpaca 配置:")
    print(f"  API Key: {ALPACA_API_KEY[:10]}...")
    print(f"  API Secret: {ALPACA_API_SECRET[:10]}...")
    print(f"  Base URL: {ALPACA_BASE_URL}")
except ImportError as e:
    print(f"导入 config 失败: {e}")
    sys.exit(1)

# 测试交易 API (paper trading)
paper_trading_url = "https://paper-api.alpaca.markets/v2/account"
headers = {
    'APCA-API-KEY-ID': ALPACA_API_KEY,
    'APCA-API-SECRET-KEY': ALPACA_API_SECRET
}

print(f"\n测试 Alpaca Paper Trading API: {paper_trading_url}")
try:
    response = requests.get(paper_trading_url, headers=headers, timeout=10)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        account_data = response.json()
        print(f"✅ Alpaca Paper Trading API 工作正常!")
        print(f"   账户 ID: {account_data.get('id', '未知')}")
        print(f"   状态: {account_data.get('status', '未知')}")
        print(f"   余额: ${float(account_data.get('cash', 0)):.2f}")
    elif response.status_code == 401:
        print(f"❌ Alpaca Paper Trading API 返回 401 Unauthorized")
        print(f"   响应: {response.text[:200]}")
    else:
        print(f"⚠️  Alpaca Paper Trading API 返回 {response.status_code}")
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"❌ Alpaca Paper Trading API 请求异常: {e}")

# 测试市场数据 API
market_data_url = "https://data.alpaca.markets/v2/stocks/AAPL/trades/latest"
print(f"\n测试 Alpaca Market Data API: {market_data_url}")
try:
    response = requests.get(market_data_url, headers=headers, timeout=10)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        trade_data = response.json()
        print(f"✅ Alpaca Market Data API 工作正常!")
        if 'trade' in trade_data:
            trade = trade_data['trade']
            print(f"   AAPL 最新交易:")
            print(f"     价格: ${trade.get('p', '未知')}")
            print(f"     数量: {trade.get('s', '未知')}")
            print(f"     交易所: {trade.get('x', '未知')}")
    elif response.status_code == 401:
        print(f"❌ Alpaca Market Data API 返回 401 Unauthorized")
        print(f"   响应: {response.text[:200]}")
    else:
        print(f"⚠️  Alpaca Market Data API 返回 {response.status_code}")
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"❌ Alpaca Market Data API 请求异常: {e}")

# 测试 snapshots endpoint
snapshots_url = "https://data.alpaca.markets/v2/stocks/snapshots?symbols=AAPL,MSFT,NVDA"
print(f"\n测试 Alpaca Snapshots API: {snapshots_url}")
try:
    response = requests.get(snapshots_url, headers=headers, timeout=10)
    print(f"状态码: {response.status_code}")
    if response.status_code == 200:
        snapshots_data = response.json()
        print(f"✅ Alpaca Snapshots API 工作正常!")
        print(f"   获取到 {len(snapshots_data)} 只股票的 snapshot 数据")
        for symbol in ['AAPL', 'MSFT', 'NVDA']:
            if symbol in snapshots_data:
                print(f"   {symbol}: 在响应中")
    elif response.status_code == 401:
        print(f"❌ Alpaca Snapshots API 返回 401 Unauthorized")
        print(f"   响应: {response.text[:200]}")
    else:
        print(f"⚠️  Alpaca Snapshots API 返回 {response.status_code}")
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"❌ Alpaca Snapshots API 请求异常: {e}")