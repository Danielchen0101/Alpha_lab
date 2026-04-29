import requests
import json
import time

def test_scanner_speed():
    """测试Market Scanner的速度"""
    url = "http://127.0.0.1:8889/api/ai/market/scanner"
    
    # 测试数据 - 只扫描2只股票
    data = {
        "symbols": ["AAPL", "MSFT"],
        "maxSymbols": 2
    }
    
    print("开始测试Market Scanner速度...")
    print(f"请求URL: {url}")
    print(f"请求数据: {json.dumps(data, indent=2)}")
    
    start_time = time.time()
    
    try:
        response = requests.post(url, json=data, timeout=30)
        end_time = time.time()
        
        print(f"\n响应时间: {end_time - start_time:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"成功: {result.get('success')}")
            print(f"消息: {result.get('message')}")
            print(f"结果数量: {len(result.get('results', []))}")
            
            if result.get('error'):
                print(f"错误: {result.get('error')}")
                print(f"错误类型: {result.get('error_type')}")
                
        else:
            print(f"响应内容: {response.text[:500]}")
            
    except requests.exceptions.Timeout:
        print("请求超时（30秒）")
    except Exception as e:
        print(f"请求失败: {str(e)}")

if __name__ == "__main__":
    test_scanner_speed()