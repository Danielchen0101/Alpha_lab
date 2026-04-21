import requests
import json

print("快速验证新闻链路...")

# 测试1: 检查后端是否运行
try:
    health = requests.get("http://127.0.0.1:8889/", timeout=5)
    print(f"健康检查: {health.status_code}")
except:
    print("后端未运行")
    exit(1)

# 测试2: 测试AI分析
url = "http://127.0.0.1:8889/api/ai/analyze/single"
payload = {"symbol": "AAPL"}

print("\n发送AI分析请求...")
try:
    response = requests.post(url, json=payload, timeout=30)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        
        print(f"\n=== 关键信息 ===")
        print(f"success: {data.get('success')}")
        print(f"symbol: {data.get('symbol')}")
        print(f"trend: {data.get('trend')}")
        
        # 检查新闻
        print(f"\n=== 新闻信息 ===")
        print(f"newsSentiment: {data.get('newsSentiment')}")
        print(f"eventRisk: {data.get('eventRisk')}")
        
        top_news = data.get('topNews')
        if top_news:
            print(f"topNews类型: {type(top_news)}")
            print(f"title: {top_news.get('title')}")
            print(f"source: {top_news.get('source')}")
        else:
            print("topNews为空")
        
        # 检查数据来源
        print(f"\n=== 数据来源 ===")
        provenance = data.get('provenance')
        if provenance:
            print(f"marketData: {provenance.get('marketData')}")
            print(f"news: {provenance.get('news')}")
        else:
            print("provenance为空")
        
        # 检查是否获取到真实新闻
        if top_news and top_news.get('title') and 'error' not in top_news.get('title', '').lower():
            print("\n✓ 获取到真实新闻!")
        else:
            print("\n✗ 未获取到真实新闻")
            
    else:
        print(f"错误: {response.text[:200]}")
        
except Exception as e:
    print(f"异常: {e}")