import requests
import json
import time

def test_ai_analyze():
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
            print("\n=== 分析结果 ===")
            print(f"success: {data.get('success')}")
            print(f"symbol: {data.get('symbol')}")
            print(f"trend: {data.get('trend')}")
            print(f"overallScore: {data.get('overallScore')}")
            
            print("\n=== 新闻信息 ===")
            print(f"newsSentiment: {data.get('newsSentiment')}")
            print(f"eventRisk: {data.get('eventRisk')}")
            
            top_news = data.get('topNews')
            print(f"\n=== topNews ===")
            if top_news:
                print(f"类型: {type(top_news)}")
                print(f"title: {top_news.get('title', 'N/A')}")
                print(f"source: {top_news.get('source', 'N/A')}")
                print(f"published: {top_news.get('published', 'N/A')}")
                print(f"summary: {top_news.get('summary', 'N/A')[:50]}...")
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

if __name__ == '__main__':
    test_ai_analyze()