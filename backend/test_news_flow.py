#!/usr/bin/env python3
"""
测试新闻数据流
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from start_quant_backend import analyze_news_for_stock, fetch_finnhub_news

def test_news_flow():
    print("=== 测试新闻数据流 ===")
    
    # 1. 测试获取原始新闻
    print("\n1. 测试获取原始新闻数据...")
    raw_news = fetch_finnhub_news('AAPL')
    if raw_news:
        print(f"获取到 {len(raw_news)} 条原始新闻")
        if len(raw_news) > 0:
            print(f"第一条新闻结构: {raw_news[0].keys()}")
            print(f"标题: {raw_news[0].get('headline', 'N/A')}")
            print(f"来源: {raw_news[0].get('source', 'N/A')}")
            print(f"时间: {raw_news[0].get('datetime', 'N/A')}")
            print(f"情绪: {raw_news[0].get('sentiment', 'N/A')}")
            print(f"URL: {raw_news[0].get('url', 'N/A')}")
            print(f"摘要: {raw_news[0].get('summary', 'N/A')[:100]}...")
    else:
        print("未获取到原始新闻数据")
    
    # 2. 测试新闻分析
    print("\n2. 测试新闻分析函数...")
    news_analysis = analyze_news_for_stock('AAPL')
    print(f"新闻分析结果: {news_analysis.keys()}")
    print(f"情绪: {news_analysis.get('sentiment')}")
    print(f"事件风险: {news_analysis.get('eventRisk')}")
    print(f"主要催化剂: {news_analysis.get('topCatalyst')}")
    print(f"新闻数量: {news_analysis.get('newsCount')}")
    print(f"新闻来源: {news_analysis.get('newsSource')}")
    print(f"是否有新闻: {news_analysis.get('hasNews')}")
    print(f"新闻摘要: {news_analysis.get('newsSummary')}")
    
    # 3. 检查头条新闻
    print("\n3. 检查头条新闻...")
    headlines = news_analysis.get('headlines', [])
    print(f"头条新闻数量: {len(headlines)}")
    if headlines:
        for i, headline in enumerate(headlines[:3]):
            print(f"头条新闻 {i+1}:")
            print(f"  标题: {headline.get('headline')}")
            print(f"  来源: {headline.get('source')}")
            print(f"  时间: {headline.get('time')}")
            print(f"  URL: {headline.get('url')}")
    
    # 4. 检查原始新闻
    print("\n4. 检查原始新闻...")
    raw_news_list = news_analysis.get('rawNews', [])
    print(f"原始新闻数量: {len(raw_news_list)}")
    if raw_news_list:
        for i, news in enumerate(raw_news_list[:2]):
            print(f"原始新闻 {i+1}:")
            print(f"  标题: {news.get('headline')}")
            print(f"  摘要: {news.get('summary', '')[:80]}...")
            print(f"  来源: {news.get('source')}")
            print(f"  时间: {news.get('datetime')}")
            print(f"  情绪: {news.get('sentiment')}")
            print(f"  URL: {news.get('url')}")

if __name__ == '__main__':
    test_news_flow()