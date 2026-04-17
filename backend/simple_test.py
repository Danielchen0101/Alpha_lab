#!/usr/bin/env python3
"""
简单测试后端是否运行
"""

import requests
import json

def test_backend():
    print("测试后端连接...")
    
    # 测试健康检查
    try:
        response = requests.get("http://127.0.0.1:8889/", timeout=5)
        print(f"健康检查状态码: {response.status_code}")
        print(f"响应: {response.text[:100]}")
    except Exception as e:
        print(f"健康检查失败: {e}")
        return False
    
    # 测试AI分析接口
    print("\n测试AI分析接口...")
    try:
        payload = {"symbol": "AAPL"}
        response = requests.post("http://127.0.0.1:8889/api/ai/analyze/single", 
                                json=payload, timeout=30)
        print(f"AI分析状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"success: {data.get('success')}")
            print(f"symbol: {data.get('symbol')}")
            print(f"trend: {data.get('trend')}")
            
            # 检查topNews
            top_news = data.get('topNews')
            print(f"\ntopNews: {top_news}")
            if top_news and isinstance(top_news, dict):
                print(f"title: {top_news.get('title')}")
                print(f"source: {top_news.get('source')}")
            else:
                print("topNews不是字典或为空")
            
            # 检查provenance
            provenance = data.get('provenance')
            print(f"\nprovenance: {provenance}")
            
            return True
        else:
            print(f"AI分析失败: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"AI分析测试失败: {e}")
        return False

if __name__ == '__main__':
    test_backend()