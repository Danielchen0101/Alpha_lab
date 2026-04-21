#!/usr/bin/env python3
"""
测试新闻数据链路
"""

import requests
import json
import time

def test_news_chain():
    print("=== 测试新闻数据链路 ===")
    
    # 测试AI分析接口
    url = "http://127.0.0.1:8889/api/ai/analyze/single"
    payload = {"symbol": "AAPL"}
    
    print("发送AI分析请求...")
    start_time = time.time()
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        elapsed = time.time() - start_time
        
        print(f"响应时间: {elapsed:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print("\n=== 新闻链路验证 ===")
            print(f"success: {data.get('success')}")
            print(f"symbol: {data.get('symbol')}")
            
            # 检查新闻相关字段
            print(f"\n新闻情绪: {data.get('newsSentiment')}")
            print(f"事件风险: {data.get('eventRisk')}")
            
            top_news = data.get('topNews')
            print(f"\n=== topNews ===")
            if top_news:
                print(f"类型: {type(top_news)}")
                print(f"title: {top_news.get('title', 'N/A')}")
                print(f"source: {top_news.get('source', 'N/A')}")
                print(f"published: {top_news.get('published', 'N/A')}")
                print(f"summary: {top_news.get('summary', 'N/A')[:100]}...")
                
                # 检查是否是真实新闻
                title = top_news.get('title', '')
                if title and title != 'No title available' and 'error' not in title.lower():
                    print("✓ 获取到真实新闻标题")
                else:
                    print("✗ 未获取到真实新闻标题")
            else:
                print("topNews为空")
            
            # 检查数据来源
            provenance = data.get('provenance')
            print(f"\n=== 数据来源 ===")
            if provenance:
                print(f"marketData: {provenance.get('marketData')}")
                print(f"companyInfo: {provenance.get('companyInfo')}")
                print(f"news: {provenance.get('news')}")
                print(f"aiAnalysis: {provenance.get('aiAnalysis')}")
                
                # 检查新闻来源
                news_source = provenance.get('news')
                if news_source and news_source != 'none':
                    print(f"✓ 新闻来源: {news_source}")
                else:
                    print("✗ 无新闻来源信息")
            else:
                print("provenance为空")
            
            # 检查6维度分数
            print(f"\n=== 6维度分数 ===")
            print(f"trendScore: {data.get('trendScore')}")
            print(f"momentumScore: {data.get('momentumScore')}")
            print(f"volumeScore: {data.get('volumeScore')}")
            print(f"volatilityScore: {data.get('volatilityScore')}")
            print(f"structureScore: {data.get('structureScore')}")
            print(f"newsScore: {data.get('newsScore')}")
            
            # 检查AI推理
            print(f"\n=== AI推理 ===")
            scanner_reason = data.get('scannerReason')
            if scanner_reason:
                print(f"scannerReason: {scanner_reason[:200]}...")
            
            detailed_reasoning = data.get('detailedReasoning')
            if detailed_reasoning:
                print(f"detailedReasoning: {detailed_reasoning[:200]}...")
            
            # 检查是否提到新闻
            if scanner_reason and ('news' in scanner_reason.lower() or 'headline' in scanner_reason.lower()):
                print("✓ AI推理中提到了新闻")
            else:
                print("✗ AI推理中未提到新闻")
            
            return True
        else:
            print(f"错误响应: {response.text[:200]}")
            return False
            
    except requests.exceptions.Timeout:
        print("请求超时 (60秒)")
        return False
    except Exception as e:
        print(f"请求异常: {e}")
        return False

def test_market_data():
    """测试市场数据"""
    print("\n=== 测试市场数据 ===")
    
    url = "http://127.0.0.1:8889/api/market/stocks"
    params = {"symbols": "AAPL"}
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            
            if stocks:
                stock = stocks[0]
                print(f"\n股票: {stock.get('symbol')}")
                print(f"价格: ${stock.get('price')}")
                print(f"涨跌幅: {stock.get('changePercent')}%")
                print(f"成交量: {stock.get('volume')}")
                print(f"日高: ${stock.get('dayHigh')}")
                print(f"日低: ${stock.get('dayLow')}")
                print(f"数据源: {stock.get('dataSource')}")
                
                # 检查关键字段
                missing = []
                if stock.get('dayHigh') is None:
                    missing.append('dayHigh')
                if stock.get('dayLow') is None:
                    missing.append('dayLow')
                if stock.get('dataSource') is None:
                    missing.append('dataSource')
                
                if missing:
                    print(f"缺失字段: {missing}")
                else:
                    print("✓ 所有关键字段都存在")
                
                return True
            else:
                print("未获取到股票数据")
                return False
        else:
            print(f"错误: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"异常: {e}")
        return False

if __name__ == '__main__':
    print("开始测试新闻数据链路...")
    
    # 测试市场数据
    market_ok = test_market_data()
    
    # 测试新闻链路
    news_ok = test_news_chain()
    
    print("\n" + "="*80)
    print("测试总结")
    print("="*80)
    print(f"市场数据测试: {'通过' if market_ok else '失败'}")
    print(f"新闻链路测试: {'通过' if news_ok else '失败'}")
    
    if market_ok and news_ok:
        print("\n✓ 所有测试通过!")
    else:
        print("\n✗ 有测试失败，需要进一步排查")