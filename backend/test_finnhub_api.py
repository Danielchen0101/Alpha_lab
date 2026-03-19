"""
直接测试Finnhub API的可用性
"""

import requests
import json
from datetime import datetime, timedelta

def test_finnhub_endpoint(endpoint, params, description):
    """测试Finnhub API端点"""
    print(f"\n测试: {description}")
    print(f"端点: {endpoint}")
    print(f"参数: {params}")
    
    api_key = "d6qsdcpr01qgdhqc82hgd6qsdcpr01qgdhqc82i0"
    base_url = "https://finnhub.io/api/v1"
    
    url = f"{base_url}{endpoint}"
    params["token"] = api_key
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"成功: {json.dumps(data, indent=2)[:200]}...")
            return True, data
        else:
            print(f"错误: {response.text[:200]}")
            return False, response.text
    except Exception as e:
        print(f"异常: {type(e).__name__}: {str(e)}")
        return False, str(e)

def test_all_finnhub_endpoints():
    """测试所有Finnhub端点"""
    print("=" * 60)
    print("测试Finnhub API端点可用性")
    print("=" * 60)
    
    symbol = "AAPL"
    
    # 计算时间范围
    to_time = int(datetime.now().timestamp())
    from_time = to_time - (3 * 24 * 60 * 60)  # 过去3天
    
    endpoints = [
        # 1. Quote端点（应该能工作）
        ("/quote", {"symbol": symbol}, "实时报价"),
        
        # 2. Profile端点
        ("/stock/profile2", {"symbol": symbol}, "公司简介"),
        
        # 3. Metric端点
        ("/stock/metric", {"symbol": symbol, "metric": "all"}, "财务指标"),
        
        # 4. Candle端点 - 日线
        ("/stock/candle", {
            "symbol": symbol,
            "resolution": "D",
            "from": from_time,
            "to": to_time
        }, "日线K线数据"),
        
        # 5. Candle端点 - 60分钟
        ("/stock/candle", {
            "symbol": symbol,
            "resolution": "60",
            "from": from_time,
            "to": to_time
        }, "60分钟K线数据"),
        
        # 6. Candle端点 - 1分钟
        ("/stock/candle", {
            "symbol": symbol,
            "resolution": "1",
            "from": from_time,
            "to": to_time
        }, "1分钟K线数据"),
    ]
    
    results = {}
    
    for endpoint, params, description in endpoints:
        success, result = test_finnhub_endpoint(endpoint, params, description)
        results[description] = {
            "success": success,
            "result": result if not success or isinstance(result, str) else "data received"
        }
    
    print(f"\n{'='*60}")
    print("测试结果总结")
    print(f"{'='*60}")
    
    for description, result in results.items():
        status = "成功" if result["success"] else "失败"
        print(f"{description}: {status}")
    
    print(f"\n{'='*60}")
    print("结论")
    print(f"{'='*60}")
    
    # 分析结果
    if results["实时报价"]["success"]:
        print("✅ 实时报价API可用")
    else:
        print("❌ 实时报价API不可用 - API密钥可能有问题")
    
    if results["日线K线数据"]["success"]:
        print("✅ 日线K线数据API可用")
    else:
        print("❌ 日线K线数据API不可用 - 可能需要付费订阅")
    
    if results["60分钟K线数据"]["success"]:
        print("✅ 60分钟K线数据API可用")
    else:
        print("❌ 60分钟K线数据API不可用 - 可能需要付费订阅")
    
    if results["1分钟K线数据"]["success"]:
        print("✅ 1分钟K线数据API可用")
    else:
        print("❌ 1分钟K线数据API不可用 - 可能需要付费订阅")

if __name__ == "__main__":
    test_all_finnhub_endpoints()