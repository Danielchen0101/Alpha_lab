import requests
import sys

def test_simple():
    """简单测试 orders 接口"""
    url = "http://127.0.0.1:8889/api/broker/orders"
    print(f"测试 {url}")
    sys.stdout.flush()
    
    try:
        response = requests.get(url, timeout=10)
        print(f"响应状态码: {response.status_code}")
        print(f"响应内容: {response.text}")
        sys.stdout.flush()
    except Exception as e:
        print(f"错误: {e}")
        sys.stdout.flush()

if __name__ == '__main__':
    test_simple()