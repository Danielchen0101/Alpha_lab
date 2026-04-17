#!/usr/bin/env python3
"""
测试修复后的三个字段：percent change, sector, news
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# 导入修复后的后端模块
from start_quant_backend_repaired import (
    get_stock_data_for_scanner,
    fetch_finnhub_profile,
    analyze_news_for_stock
)

def test_percent_change():
    """测试percent change字段"""
    print("=" * 80)
    print("测试 1: Percent Change 字段")
    print("=" * 80)
    
    # 测试多个symbol
    test_symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA']
    
    for symbol in test_symbols:
        print(f"\n测试 {symbol}:")
        try:
            stock_data, news_data, profile_data, analysis_result = get_stock_data_for_scanner(symbol)
            
            print(f"  stock_data keys: {list(stock_data.keys())}")
            print(f"  changePercent: {stock_data.get('changePercent')}")
            print(f"  changePct: {stock_data.get('changePct')}")
            print(f"  changeSource: {stock_data.get('changeSource')}")
            
            # 检查两个字段是否存在且值相同
            if 'changePercent' in stock_data and 'changePct' in stock_data:
                if stock_data['changePercent'] == stock_data['changePct']:
                    print(f"  ✅ changePercent 和 changePct 字段都存在且值相同")
                else:
                    print(f"  ⚠️ changePercent 和 changePct 值不同")
            elif 'changePct' in stock_data:
                print(f"  ✅ changePct 字段存在: {stock_data['changePct']}")
            else:
                print(f"  ❌ changePct 字段不存在")
                
        except Exception as e:
            print(f"  ❌ 测试失败: {e}")

def test_sector():
    """测试sector字段"""
    print("\n" + "=" * 80)
    print("测试 2: Sector 字段")
    print("=" * 80)
    
    test_symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA']
    
    for symbol in test_symbols:
        print(f"\n测试 {symbol}:")
        try:
            # 直接调用fetch_finnhub_profile
            profile_data, error = fetch_finnhub_profile(symbol)
            
            if error:
                print(f"  ❌ Finnhub profile API错误: {error}")
                continue
                
            if profile_data:
                print(f"  Finnhub返回的profile数据:")
                print(f"    name: {profile_data.get('name')}")
                print(f"    sector: {profile_data.get('sector')}")
                print(f"    finnhubSector: {profile_data.get('finnhubSector')}")
                print(f"    marketCapitalization: {profile_data.get('marketCapitalization')}")
                
                if profile_data.get('sector') or profile_data.get('finnhubSector'):
                    sector = profile_data.get('sector') or profile_data.get('finnhubSector')
                    print(f"  ✅ 获取到sector: {sector}")
                else:
                    print(f"  ⚠️ profile数据中没有sector字段")
            else:
                print(f"  ❌ 没有获取到profile数据")
                
        except Exception as e:
            print(f"  ❌ 测试失败: {e}")

def test_news():
    """测试news字段"""
    print("\n" + "=" * 80)
    print("测试 3: News 字段")
    print("=" * 80)
    
    test_symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA']
    
    for symbol in test_symbols:
        print(f"\n测试 {symbol}:")
        try:
            news_data = analyze_news_for_stock(symbol)
            
            print(f"  news_data keys: {list(news_data.keys())}")
            print(f"  sentiment: {news_data.get('sentiment')}")
            print(f"  eventRisk: {news_data.get('eventRisk')}")
            print(f"  topCatalyst: {news_data.get('topCatalyst')}")
            print(f"  newsCount: {news_data.get('newsCount')}")
            print(f"  newsSource: {news_data.get('newsSource')}")
            print(f"  hasNews: {news_data.get('hasNews')}")
            
            # 检查是否来自Finnhub
            if news_data.get('newsSource', '').startswith('Finnhub'):
                print(f"  ✅ News数据来自Finnhub")
            else:
                print(f"  ⚠️ News数据来源不是Finnhub: {news_data.get('newsSource')}")
                
        except Exception as e:
            print(f"  ❌ 测试失败: {e}")

def test_scanner_integration():
    """测试完整的scanner集成"""
    print("\n" + "=" * 80)
    print("测试 4: 完整Scanner集成")
    print("=" * 80)
    
    test_symbols = ['AAPL', 'MSFT']
    
    for symbol in test_symbols:
        print(f"\n测试完整scanner链路 {symbol}:")
        try:
            stock_data, news_data, profile_data, analysis_result = get_stock_data_for_scanner(symbol)
            
            print(f"  1. Stock Data:")
            print(f"     price: {stock_data.get('price')}")
            print(f"     changePercent: {stock_data.get('changePercent')}")
            print(f"     changePct: {stock_data.get('changePct')}")
            print(f"     volume: {stock_data.get('volume')}")
            
            print(f"  2. Profile Data:")
            print(f"     name: {profile_data.get('name')}")
            print(f"     sector: {profile_data.get('sector')}")
            print(f"     finnhubSector: {profile_data.get('finnhubSector')}")
            
            print(f"  3. News Data:")
            print(f"     sentiment: {news_data.get('sentiment')}")
            print(f"     eventRisk: {news_data.get('eventRisk')}")
            print(f"     topCatalyst: {news_data.get('topCatalyst')}")
            print(f"     newsSource: {news_data.get('newsSource')}")
            
            # 验证所有字段都存在
            issues = []
            if not stock_data.get('changePct'):
                issues.append("changePct字段为空")
            if not profile_data.get('sector'):
                issues.append("sector字段为空")
            if not news_data.get('newsSource', '').startswith('Finnhub'):
                issues.append("news不是来自Finnhub")
                
            if issues:
                print(f"  ⚠️ 存在问题: {', '.join(issues)}")
            else:
                print(f"  ✅ 所有字段正常")
                
        except Exception as e:
            print(f"  ❌ 测试失败: {e}")

def main():
    """主测试函数"""
    print("修复后字段测试")
    print("=" * 80)
    
    # 测试percent change
    test_percent_change()
    
    # 测试sector
    test_sector()
    
    # 测试news
    test_news()
    
    # 测试完整集成
    test_scanner_integration()
    
    print("\n" + "=" * 80)
    print("测试完成")
    print("=" * 80)

if __name__ == "__main__":
    main()