#!/usr/bin/env python3
"""
测试AI分析接口
"""

import requests
import json

def test_ai_analyze():
    print("=== 测试AI分析接口 ===")
    
    url = "http://127.0.0.1:8889/api/ai/analyze/single"
    payload = {
        "symbol": "AAPL",
        "debug": True
    }
    
    try:
        print(f"发送请求到: {url}")
        print(f"请求数据: {json.dumps(payload, indent=2)}")
        
        response = requests.post(url, json=payload, timeout=30)
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"响应数据:")
            print(json.dumps(data, indent=2))
            
            # 检查关键字段
            print("\n=== 关键字段检查 ===")
            print(f"success: {data.get('success')}")
            print(f"symbol: {data.get('symbol')}")
            print(f"trend: {data.get('trend')}")
            print(f"overallScore: {data.get('overallScore')}")
            print(f"newsSentiment: {data.get('newsSentiment')}")
            print(f"eventRisk: {data.get('eventRisk')}")
            
            # 检查topNews
            top_news = data.get('topNews')
            print(f"\n=== topNews检查 ===")
            if top_news:
                print(f"topNews类型: {type(top_news)}")
                print(f"topNews内容: {top_news}")
                print(f"title: {top_news.get('title')}")
                print(f"source: {top_news.get('source')}")
                print(f"published: {top_news.get('published')}")
                print(f"url: {top_news.get('url')}")
                print(f"summary: {top_news.get('summary')}")
            else:
                print("topNews为None或空")
            
            # 检查provenance
            provenance = data.get('provenance')
            print(f"\n=== 数据来源检查 ===")
            if provenance:
                print(f"marketData: {provenance.get('marketData')}")
                print(f"companyInfo: {provenance.get('companyInfo')}")
                print(f"news: {provenance.get('news')}")
                print(f"aiAnalysis: {provenance.get('aiAnalysis')}")
            else:
                print("provenance为None或空")
                
        else:
            print(f"错误响应: {response.text}")
            
    except Exception as e:
        print(f"请求失败: {str(e)}")

if __name__ == '__main__':
    test_ai_analyze()