import requests

print("简单测试Polygon API...")

POLYGON_API_KEY = 'vx8LMXnMYMpBonwfXE2ssfqSo7WwcnlB'
POLYGON_BASE_URL = 'https://api.polygon.io'

# 测试日线数据（我们知道这个工作）
print("\n1. 测试日线数据 (应该工作):")
try:
    url = f"{POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/range/1/day/2026-03-01/2026-03-05"
    params = {'apiKey': POLYGON_API_KEY, 'adjusted': 'true', 'sort': 'asc'}
    
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"成功! 结果数量: {data.get('resultsCount', 0)}")
    elif response.status_code == 400:
        print(f"400错误，响应: {response.text[:200]}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试分钟数据
print("\n2. 测试分钟数据 (可能有限制):")
try:
    # 尝试不同的时间范围
    url = f"{POLYGON_BASE_URL}/v2/aggs/ticker/AAPL/range/1/minute/2026-03-18/2026-03-19"
    params = {'apiKey': POLYGON_API_KEY, 'adjusted': 'true', 'sort': 'asc'}
    
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"成功! 结果数量: {data.get('resultsCount', 0)}")
    elif response.status_code == 400:
        print(f"400错误，响应: {response.text[:200]}")
    elif response.status_code == 429:
        print(f"429 请求频率限制")
except Exception as e:
    print(f"请求失败: {e}")

# 检查API套餐限制
print("\n3. 检查API套餐:")
print("根据Polygon文档:")
print("- 免费套餐: 可能只支持日线数据")
print("- 付费套餐: 支持分钟级数据")
print("- 我们可能在使用免费套餐，所以分钟数据返回400")

print("\n=== 解决方案 ===")
print("1. 如果Polygon免费套餐不支持分钟数据，我们可以:")
print("   - 继续使用日线数据")
print("   - 使用Finnhub作为分钟数据备源")
print("   - 或者升级Polygon套餐")

print("\n2. 当前实现:")
print("   - 1 Day: 使用日线数据，但X轴显示时间格式")
print("   - 1 Week: 使用日线数据，但X轴显示日期+时间格式")
print("   - 这样至少X轴显示是正确的，即使数据粒度不是分钟级")