import requests
import json

# 测试 Finnhub API 直接调用
FINNHUB_API_KEY = 'd6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0'
FINNHUB_BASE_URL = 'https://finnhub.io/api/v1'

def test_finnhub_api():
    symbol = 'AAPL'
    
    print(f"Testing Finnhub API for {symbol}...")
    
    # 1. 测试 Quote API
    print("\n1. Testing Quote API...")
    quote_url = f"{FINNHUB_BASE_URL}/quote"
    quote_params = {
        'symbol': symbol,
        'token': FINNHUB_API_KEY
    }
    
    try:
        quote_response = requests.get(quote_url, params=quote_params, timeout=10)
        print(f"Status Code: {quote_response.status_code}")
        if quote_response.status_code == 200:
            quote_data = quote_response.json()
            print(f"Quote Data: {json.dumps(quote_data, indent=2)}")
        else:
            print(f"Error: {quote_response.text}")
    except Exception as e:
        print(f"Quote API Error: {e}")
    
    # 2. 测试 Profile API
    print("\n2. Testing Profile API...")
    profile_url = f"{FINNHUB_BASE_URL}/stock/profile2"
    profile_params = {
        'symbol': symbol,
        'token': FINNHUB_API_KEY
    }
    
    try:
        profile_response = requests.get(profile_url, params=profile_params, timeout=10)
        print(f"Status Code: {profile_response.status_code}")
        if profile_response.status_code == 200:
            profile_data = profile_response.json()
            print(f"Profile Data: {json.dumps(profile_data, indent=2)}")
        else:
            print(f"Error: {profile_response.text}")
    except Exception as e:
        print(f"Profile API Error: {e}")
    
    # 3. 测试 Metrics API
    print("\n3. Testing Metrics API...")
    metrics_url = f"{FINNHUB_BASE_URL}/stock/metric"
    metrics_params = {
        'symbol': symbol,
        'metric': 'all',
        'token': FINNHUB_API_KEY
    }
    
    try:
        metrics_response = requests.get(metrics_url, params=metrics_params, timeout=10)
        print(f"Status Code: {metrics_response.status_code}")
        if metrics_response.status_code == 200:
            metrics_data = metrics_response.json()
            print(f"Metrics Data: {json.dumps(metrics_data, indent=2)}")
        else:
            print(f"Error: {metrics_response.text}")
    except Exception as e:
        print(f"Metrics API Error: {e}")

if __name__ == "__main__":
    test_finnhub_api()