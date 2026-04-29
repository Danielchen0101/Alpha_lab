"""
测试AI调用链路的简化脚本
"""

import requests
import json
import time

def test_ai_call(symbol):
    """测试单个symbol的AI调用"""
    print(f"\n{'='*60}")
    print(f"测试股票: {symbol}")
    print(f"{'='*60}")
    
    url = "http://127.0.0.1:8889/ai/analyze/single"
    payload = {"symbol": symbol}
    
    try:
        print(f"[1] 发送请求到: {url}")
        print(f"[1] 请求数据: {json.dumps(payload)}")
        
        start_time = time.time()
        response = requests.post(url, json=payload, timeout=30)
        end_time = time.time()
        
        print(f"[2] 响应状态码: {response.status_code}")
        print(f"[2] 响应时间: {end_time - start_time:.2f}秒")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[3] 响应数据: {json.dumps(data, indent=2, ensure_ascii=False)}")
            
            if data.get('success'):
                print(f"[4] AI调用成功!")
                print(f"    - trendLabel: {data.get('trendLabel')}")
                print(f"    - trendScore: {data.get('trendScore')}")
                print(f"    - aiReasoning: {data.get('aiReasoning')}")
                return True, data
            else:
                print(f"[4] AI调用失败: {data.get('error', 'Unknown error')}")
                return False, data
        else:
            print(f"[3] HTTP错误: {response.status_code}")
            print(f"[3] 响应内容: {response.text}")
            return False, None
            
    except requests.exceptions.ConnectionError:
        print(f"[ERROR] 无法连接到后端服务 (端口8889)")
        print(f"[INFO] 请确保后端服务正在运行")
        return False, None
    except requests.exceptions.Timeout:
        print(f"[ERROR] 请求超时 (30秒)")
        return False, None
    except Exception as e:
        print(f"[ERROR] 异常: {str(e)}")
        return False, None

def main():
    """主函数"""
    print("开始测试AI调用链路...")
    
    # 测试符号列表
    test_symbols = ["AAPL", "MSFT", "GOOGL", "INVALID", "TEST123"]
    
    results = []
    for symbol in test_symbols:
        success, data = test_ai_call(symbol)
        results.append({
            "symbol": symbol,
            "success": success,
            "data": data
        })
        time.sleep(1)  # 避免请求过快
    
    # 汇总结果
    print(f"\n{'='*60}")
    print("测试结果汇总:")
    print(f"{'='*60}")
    
    for result in results:
        symbol = result["symbol"]
        success = result["success"]
        data = result["data"]
        
        if success:
            print(f"✓ {symbol}: 成功")
            if data:
                print(f"  趋势标签: {data.get('trendLabel')}")
                print(f"  趋势分数: {data.get('trendScore')}")
                print(f"  AI推理: {data.get('aiReasoning', 'N/A')[:50]}...")
        else:
            print(f"✗ {symbol}: 失败")
            if data and 'error' in data:
                print(f"  错误: {data['error']}")
    
    # 检查后端服务状态
    try:
        health_response = requests.get("http://127.0.0.1:8889/health", timeout=5)
        if health_response.status_code == 200:
            print(f"\n✓ 后端服务健康检查: 正常")
        else:
            print(f"\n✗ 后端服务健康检查: 异常 (状态码: {health_response.status_code})")
    except:
        print(f"\n✗ 后端服务健康检查: 无法连接")

if __name__ == "__main__":
    main()