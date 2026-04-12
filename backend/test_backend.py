import requests
import json

# 测试状态端点
try:
    response = requests.get("http://127.0.0.1:8892/api/status", timeout=5)
    print(f"Status endpoint response: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error calling status endpoint: {e}")

# 测试Backtest请求
backtest_payload = {
    "symbol": "AAPL",
    "strategy": "moving_average",
    "startDate": "2024-01-01",
    "endDate": "2024-12-31",
    "initialCapital": 100000,
    "parameters": {
        "shortMaPeriod": 20,
        "longMaPeriod": 50
    }
}

print("\nSending backtest request...")
try:
    response = requests.post("http://127.0.0.1:8892/api/backtest/run", 
                           json=backtest_payload,
                           timeout=30)
    print(f"Backtest response status: {response.status_code}")
    print(f"Response body: {response.text}")
except Exception as e:
    print(f"Error calling backtest endpoint: {e}")