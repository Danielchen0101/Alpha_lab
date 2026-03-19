"""
测试修复后的Finnhub服务
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from finnhub_service import FinnhubService
import json

print("=== 测试修复后的Finnhub服务 ===")

# 创建服务实例
service = FinnhubService()

print("\n1. 测试单个股票数据获取:")
aapl_data = service.get_stock_data("AAPL")
print("AAPL数据:")
print(json.dumps(aapl_data, indent=2, ensure_ascii=False))

print("\n2. 测试批量数据获取:")
batch_data = service.get_multiple_stocks(["AAPL", "MSFT", "GOOGL", "TSLA", "NVDA"])
print(f"成功获取: {batch_data['count']} 只股票")
print(f"数据源: {batch_data['dataSource']}")

if batch_data['stocks']:
    first_stock = batch_data['stocks'][0]
    print(f"\n第一个股票详情:")
    print(f"  代码: {first_stock['symbol']}")
    print(f"  名称: {first_stock['name']}")
    print(f"  价格: ${first_stock['price']}")
    print(f"  涨跌: {first_stock['change']}")
    print(f"  涨跌幅: {first_stock['changePercent']}%")
    print(f"  前收盘: ${first_stock['previousClose']}")
    print(f"  成交量: {first_stock['volume']}")
    print(f"  市值: ${first_stock['marketCap']}")
    print(f"  行业: {first_stock['sector']}")
    print(f"  数据源: {first_stock['dataSource']}")

print("\n3. 测试缓存:")
print("第一次获取AAPL（应该调用API）")
data1 = service.get_stock_data("AAPL")
print("第二次获取AAPL（应该使用缓存）")
data2 = service.get_stock_data("AAPL")
print(f"两次获取结果相同: {data1.get('price') == data2.get('price')}")

print("\n4. 清理缓存测试:")
service.clear_cache()
print("缓存已清理")

print("\n5. 字段映射检查:")
print("=" * 60)
print("关键字段映射:")
fields_to_check = [
    ("price", "当前价格（不是前收盘价）"),
    ("change", "真实涨跌额（不是0）"),
    ("changePercent", "真实涨跌幅（不是0）"),
    ("previousClose", "前收盘价（单独保留）"),
    ("marketCap", "市值（已从百万转换为美元）"),
    ("sector", "行业（finnhubIndustry映射）"),
    ("dataSource", "数据源（统一为'Finnhub'）")
]

for field, description in fields_to_check:
    value = aapl_data.get(field)
    if value is None:
        status = "❌ 空值"
    elif field in ["change", "changePercent"] and value == 0:
        status = "⚠️ 注意：值为0（可能是真实0，不是伪造）"
    else:
        status = "✅ 正常"
    print(f"  {field}: {value} - {description}")
    print(f"    状态: {status}")

print("\n=== 验证完成 ===")