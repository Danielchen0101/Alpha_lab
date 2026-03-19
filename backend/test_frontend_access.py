import requests
import json

print("Testing frontend proxy access to backend APIs:")
print("=" * 60)

# Test through frontend proxy (port 3000)
endpoints = [
    "/api/market/stock/AAPL",
    "/api/market/history/AAPL?interval=1day&range=1month"
]

for endpoint in endpoints:
    print(f"\nTesting {endpoint}:")
    try:
        # Try through frontend proxy
        url = f"http://localhost:3000{endpoint}"
        response = requests.get(url, timeout=10)
        print(f"  Frontend proxy (port 3000): Status {response.status_code}")
        
        # Try direct backend
        url = f"http://localhost:8889{endpoint}"
        response = requests.get(url, timeout=10)
        print(f"  Direct backend (port 8889): Status {response.status_code}")
        
    except Exception as e:
        print(f"  Error: {e}")

print("\n" + "=" * 60)
print("Summary of API responses:")

# Test the complete flow
print("\n1. Complete stock data (Analysis page needs):")
try:
    response = requests.get('http://localhost:8889/api/market/stock/AAPL', timeout=10)
    data = response.json()
    
    required_fields = ['name', 'price', 'marketCap', 'sector', 'peRatio', 'dividendYield', 'yearHigh', 'yearLow']
    missing_fields = []
    
    for field in required_fields:
        value = data.get(field)
        if value is None:
            missing_fields.append(field)
        else:
            print(f"  ✓ {field}: {value}")
    
    if missing_fields:
        print(f"  ✗ Missing fields: {missing_fields}")
    else:
        print(f"  ✅ All required fields available for Analysis page")
        
except Exception as e:
    print(f"  Error: {e}")

print("\n2. Historical data (Price Chart needs):")
try:
    response = requests.get('http://localhost:8889/api/market/history/AAPL?interval=1day&range=1month', timeout=10)
    data = response.json()
    
    count = data.get('count', 0)
    source = data.get('source', 'unknown')
    
    print(f"  Data points: {count}")
    print(f"  Source: {source}")
    
    if count > 0:
        print(f"  ✅ Price Chart will have data to display")
        # Check data structure
        if data.get('data') and len(data['data']) > 0:
            first_item = data['data'][0]
            has_ohlc = all(key in first_item for key in ['open', 'high', 'low', 'close'])
            print(f"  Data structure: {'✓ OHLC complete' if has_ohlc else '✗ Missing OHLC fields'}")
    else:
        print(f"  ✗ Price Chart will be empty")
        
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "=" * 60)
print("Expected frontend behavior:")
print("1. Analysis page should show real data (not '--')")
print("2. Price Chart should display candlestick chart")
print("3. Timeframe switching should work (1D, 1W, 1M, 3M, 1Y)")
print("4. All numeric fields should show values or '--' if null")