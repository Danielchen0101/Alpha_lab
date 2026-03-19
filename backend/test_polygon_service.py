#!/usr/bin/env python3
"""
测试 Polygon 服务
"""

import os
import sys
import json

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 设置环境变量
os.environ['POLYGON_API_KEY'] = 'Pb17vE12y3eH4ixU_P3or5W89TfFbN7E'

try:
    from services.polygon_service import PolygonService
    
    print("🚀 测试 Polygon 服务")
    print("=" * 50)
    
    # 创建服务实例
    polygon_service = PolygonService()
    
    # 测试获取股票详情
    print("\n1. 测试获取股票详情 (AAPL):")
    try:
        details = polygon_service.get_ticker_details("AAPL")
        print(f"   状态: ✅ 成功")
        print(f"   公司名称: {details.get('name', 'N/A')}")
        print(f"   行业: {details.get('sic_description', 'N/A')}")
        print(f"   市值: {details.get('market_cap', 'N/A')}")
    except Exception as e:
        print(f"   状态: ❌ 失败 - {e}")
    
    # 测试获取前一日收盘
    print("\n2. 测试获取前一日收盘 (AAPL):")
    try:
        prev_close = polygon_service.get_previous_close("AAPL")
        print(f"   状态: ✅ 成功")
        print(f"   收盘价: {prev_close.get('c', 'N/A')}")
        print(f"   涨跌: {prev_close.get('d', 'N/A')}")
        print(f"   涨跌幅: {prev_close.get('dp', 'N/A')}%")
    except Exception as e:
        print(f"   状态: ❌ 失败 - {e}")
    
    # 测试搜索股票
    print("\n3. 测试搜索股票 (AAPL):")
    try:
        search_result = polygon_service.search_tickers("AAPL", 5)
        print(f"   状态: ✅ 成功")
        print(f"   结果数量: {len(search_result.get('results', []))}")
        for i, ticker in enumerate(search_result.get('results', [])[:3]):
            print(f"     {i+1}. {ticker.get('ticker', 'N/A')} - {ticker.get('name', 'N/A')}")
    except Exception as e:
        print(f"   状态: ❌ 失败 - {e}")
    
    # 测试格式化股票数据
    print("\n4. 测试格式化股票数据:")
    try:
        details = polygon_service.get_ticker_details("AAPL")
        prev_close = polygon_service.get_previous_close("AAPL")
        formatted = polygon_service.format_stock_data("AAPL", details, prev_close)
        print(f"   状态: ✅ 成功")
        print(f"   格式化数据:")
        for key, value in formatted.items():
            print(f"     {key}: {value}")
    except Exception as e:
        print(f"   状态: ❌ 失败 - {e}")
    
    print("\n" + "=" * 50)
    print("✅ Polygon 服务测试完成")
    
except Exception as e:
    print(f"❌ 测试失败: {e}")
    import traceback
    traceback.print_exc()