#!/usr/bin/env python3
"""
测试修改后的 fetch_real_stock_data 函数
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from start_quant_backend import fetch_real_stock_data

def test_fetch_real_stock_data():
    """测试 fetch_real_stock_data 函数"""
    print("=== 测试 fetch_real_stock_data 函数 ===")
    print("使用 Finnhub API 获取 AAPL 数据...")
    
    # 测试 AAPL
    symbol = "AAPL"
    data = fetch_real_stock_data(symbol)
    
    if data is None:
        print(f"❌ 无法获取 {symbol} 数据")
        return False
    
    print(f"\n✅ 成功获取 {symbol} 数据")
    print(f"返回字段数量: {len(data)}")
    
    # 检查必需字段
    required_fields = [
        "symbol", "name", "price", "change", "changePercent",
        "high", "low", "open", "prevClose", "volume",
        "marketCap", "sector"
    ]
    
    print("\n=== 字段检查 ===")
    for field in required_fields:
        value = data.get(field)
        if value is None:
            print(f"  ⚠️  {field}: None (缺失)")
        else:
            print(f"  ✅  {field}: {value}")
    
    # 详细数据展示
    print("\n=== 详细数据 ===")
    print(f"股票代码: {data['symbol']}")
    print(f"公司名称: {data['name']}")
    print(f"当前价格: ${data['price']}")
    print(f"涨跌: ${data['change']} ({data['changePercent']}%)")
    print(f"当日区间: ${data['low']} - ${data['high']}")
    print(f"开盘价: ${data['open']}")
    print(f"前收盘: ${data['prevClose']}")
    print(f"成交量: {data['volume']}")
    print(f"市值: ${data['marketCap']:,.2f}" if data['marketCap'] else "市值: None")
    print(f"行业: {data['sector']}")
    print(f"数据源: {data.get('dataSource', 'N/A')}")
    
    # 测试其他股票
    print("\n=== 测试其他股票 ===")
    test_symbols = ["MSFT", "GOOGL", "TSLA", "INVALID"]
    
    for symbol in test_symbols:
        print(f"\n测试 {symbol}...")
        data = fetch_real_stock_data(symbol)
        if data:
            print(f"  ✅ 成功: ${data['price']} ({data.get('name', 'N/A')})")
        else:
            print(f"  ❌ 失败: 无法获取数据")
    
    return True

if __name__ == "__main__":
    success = test_fetch_real_stock_data()
    if success:
        print("\n✅ 所有测试完成")
    else:
        print("\n❌ 测试失败")
        sys.exit(1)