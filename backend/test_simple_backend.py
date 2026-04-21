#!/usr/bin/env python3
"""
测试简单后端
"""

import requests
import json
import time

def test_backend():
    """测试后端"""
    print("测试简单后端")
    print("="*60)
    
    # 测试健康检查
    print("1. 测试健康检查:")
    try:
        health_response = requests.get("http://127.0.0.1:8889/health", timeout=5)
        print(f"   状态码: {health_response.status_code}")
        print(f"   响应: {health_response.json()}")
    except Exception as e:
        print(f"   错误: {str(e)}")
    
    # 测试AI分析
    print("\n2. 测试AI分析 (AAPL):")
    try:
        start_time = time.time()
        ai_response = requests.post(
            "http://127.0.0.1:8889/ai/analyze/single",
            json={"symbol": "AAPL"},
            timeout=10
        )
        response_time = time.time() - start_time
        
        print(f"   响应时间: {response_time:.2f}秒")
        print(f"   状态码: {ai_response.status_code}")
        
        if ai_response.status_code == 200:
            data = ai_response.json()
            print(f"   成功: {data.get('success')}")
            
            if data.get('success'):
                print(f"   趋势: {data.get('trend')}")
                print(f"   总体分数: {data.get('overallScore')}")
                print(f"   AI推理: {data.get('aiReasoning', '')[:50]}...")
                print(f"   AI数据源: {data.get('provenance', {}).get('aiAnalysis')}")
                print(f"   有AI数据: {data.get('hasAiData', False)}")
            else:
                print(f"   错误: {data.get('error')}")
                print(f"   失败阶段: {data.get('stage')}")
                print(f"   提供商: {data.get('provider')}")
        else:
            print(f"   HTTP错误: {ai_response.status_code}")
            print(f"   响应: {ai_response.text[:200]}")
            
    except requests.exceptions.Timeout:
        print("   请求超时 (10秒)")
    except Exception as e:
        print(f"   异常: {str(e)}")
    
    # 测试无效symbol
    print("\n3. 测试无效请求:")
    try:
        invalid_response = requests.post(
            "http://127.0.0.1:8889/ai/analyze/single",
            json={},  # 没有symbol
            timeout=5
        )
        print(f"   状态码: {invalid_response.status_code}")
        print(f"   响应: {invalid_response.json()}")
    except Exception as e:
        print(f"   错误: {str(e)}")

if __name__ == '__main__':
    test_backend()