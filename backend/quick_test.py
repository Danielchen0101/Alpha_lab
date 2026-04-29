import requests
import json

# 测试AI分析
url = "http://127.0.0.1:8889/api/ai/analyze/single"
payload = {"symbol": "AAPL"}

print("发送请求...")
response = requests.post(url, json=payload, timeout=30)
print(f"状态码: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print("\n=== 关键字段 ===")
    print(f"success: {data.get('success')}")
    print(f"symbol: {data.get('symbol')}")
    print(f"trend: {data.get('trend')}")
    print(f"overallScore: {data.get('overallScore')}")
    
    print("\n=== 新闻相关 ===")
    print(f"newsSentiment: {data.get('newsSentiment')}")
    print(f"eventRisk: {data.get('eventRisk')}")
    
    top_news = data.get('topNews')
    print(f"\n=== topNews ===")
    if top_news:
        print(f"类型: {type(top_news)}")
        print(f"title: {top_news.get('title')}")
        print(f"source: {top_news.get('source')}")
        print(f"published: {top_news.get('published')}")
    else:
        print("topNews为空")
    
    print("\n=== 数据来源 ===")
    provenance = data.get('provenance')
    if provenance:
        print(f"marketData: {provenance.get('marketData')}")
        print(f"companyInfo: {provenance.get('companyInfo')}")
        print(f"news: {provenance.get('news')}")
        print(f"aiAnalysis: {provenance.get('aiAnalysis')}")
    
    print("\n=== 6维度分数 ===")
    print(f"trendScore: {data.get('trendScore')}")
    print(f"momentumScore: {data.get('momentumScore')}")
    print(f"volumeScore: {data.get('volumeScore')}")
    print(f"volatilityScore: {data.get('volatilityScore')}")
    print(f"structureScore: {data.get('structureScore')}")
    print(f"newsScore: {data.get('newsScore')}")
else:
    print(f"错误: {response.text}")