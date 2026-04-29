import requests
import json
import time

def test_scanner_fast():
    """快速测试Market Scanner"""
    url = "http://127.0.0.1:8889/api/ai/market/scanner"
    
    # 只测试1只股票
    data = {
        "symbols": ["AAPL"],
        "maxSymbols": 1
    }
    
    print("快速测试Market Scanner...")
    start_time = time.time()
    
    try:
        response = requests.post(url, json=data, timeout=10)
        end_time = time.time()
        
        print(f"响应时间: {end_time - start_time:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"成功: {result.get('success')}")
            print(f"消息: {result.get('message')}")
            
            if result.get('scan_stats'):
                stats = result.get('scan_stats')
                print(f"扫描统计: {stats}")
                
        else:
            print(f"响应: {response.text[:200]}")
            
    except Exception as e:
        print(f"错误: {str(e)}")

if __name__ == "__main__":
    test_scanner_fast()