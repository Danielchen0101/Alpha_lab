#!/usr/bin/env python3
"""
测试 Polygon 服务端点
"""

import os
import sys
import json

# 设置环境变量
os.environ['POLYGON_API_KEY'] = 'Pb17vE12y3eH4ixU_P3or5W89TfFbN7E'

# 添加当前目录到路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from services.polygon_service import PolygonService
    
    print("🚀 测试 Polygon 服务端点")
    print("=" * 50)
    
    # 创建服务实例
    polygon_service = PolygonService()
    
    # 测试 1: 获取股票详情
    print("\n1. 测试获取股票详情 (AAPL):")
    try:
        details = polygon_service.get_ticker_details("AAPL")
        print(f"   状态: ✅ 成功")
        print(f"   响应字段: {list(details.keys())}")
        
        # 显示关键信息
        print(f"   公司名称: {details.get('name', 'N/A')}")
        print(f"   行业: {details.get('sic_description', 'N/A')}")
        print(f"   市值: {details.get('market_cap', 'N/A')}")
        print(f"   货币: {details.get('currency_name', 'N/A')}")
        
    except Exception as e:
        print(f"   状态: ❌ 失败 - {e}")
    
    # 测试 2: 获取前一日收盘
    print("\n2. 测试获取前一日收盘 (AAPL):")
    try:
        prev_close = polygon_service.get_previous_close("AAPL")
        print(f"   状态: ✅ 成功")
        print(f"   响应字段: {list(prev_close.keys())}")
        
        if prev_close.get('results'):
            result = prev_close['results'][0]
            print(f"   收盘价: {result.get('c', 'N/A')}")
            print(f"   涨跌: {result.get('d', 'N/A')}")
            print(f"   涨跌幅: {result.get('dp', 'N/A')}%")
            print(f"   最高: {result.get('h', 'N/A')}")
            print(f"   最低: {result.get('l', 'N/A')}")
            print(f"   成交量: {result.get('v', 'N/A')}")
        
    except Exception as e:
        print(f"   状态: ❌ 失败 - {e}")
    
    # 测试 3: 搜索股票
    print("\n3. 测试搜索股票 (AAPL):")
    try:
        search_result = polygon_service.search_tickers("AAPL", 3)
        print(f"   状态: ✅ 成功")
        print(f"   结果数量: {len(search_result.get('results', []))}")
        
        for i, ticker in enumerate(search_result.get('results', [])[:3]):
            print(f"     {i+1}. {ticker.get('ticker', 'N/A')} - {ticker.get('name', 'N/A')}")
        
    except Exception as e:
        print(f"   状态: ❌ 失败 - {e}")
    
    # 测试 4: 获取聚合数据
    print("\n4. 测试获取聚合数据 (AAPL, 1个月):")
    try:
        aggregates = polygon_service.get_aggregates("AAPL", "1M")
        print(f"   状态: ✅ 成功")
        print(f"   数据点数: {len(aggregates.get('results', []))}")
        
        if aggregates.get('results'):
            result = aggregates['results'][0]
            print(f"   第一个数据点:")
            print(f"     时间: {result.get('t', 'N/A')}")
            print(f"     开盘: {result.get('o', 'N/A')}")
            print(f"     最高: {result.get('h', 'N/A')}")
            print(f"     最低: {result.get('l', 'N/A')}")
            print(f"     收盘: {result.get('c', 'N/A')}")
            print(f"     成交量: {result.get('v', 'N/A')}")
        
    except Exception as e:
        print(f"   状态: ❌ 失败 - {e}")
    
    # 测试 5: 格式化股票数据
    print("\n5. 测试格式化股票数据:")
    try:
        details = polygon_service.get_ticker_details("AAPL")
        prev_close = polygon_service.get_previous_close("AAPL")
        formatted = polygon_service.format_stock_data("AAPL", details, prev_close)
        
        print(f"   状态: ✅ 成功")
        print(f"   格式化字段: {list(formatted.keys())}")
        
        # 显示关键格式化数据
        print(f"   符号: {formatted.get('symbol', 'N/A')}")
        print(f"   名称: {formatted.get('name', 'N/A')}")
        print(f"   价格: {formatted.get('price', 'N/A')}")
        print(f"   涨跌: {formatted.get('change', 'N/A')}")
        print(f"   涨跌幅: {formatted.get('changePercent', 'N/A')}%")
        print(f"   市值: {formatted.get('marketCap', 'N/A')}")
        print(f"   行业: {formatted.get('sector', 'N/A')}")
        print(f"   数据源: {formatted.get('dataSource', 'N/A')}")
        
    except Exception as e:
        print(f"   状态: ❌ 失败 - {e}")
    
    print("\n" + "=" * 50)
    print("✅ Polygon 服务端点测试完成")
    
except Exception as e:
    print(f"❌ 测试失败: {e}")
    import traceback
    traceback.print_exc()