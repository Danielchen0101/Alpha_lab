import requests
import json

# 尝试触发500错误的各种场景
base_url = "http://127.0.0.1:8890"

test_cases = [
    # 正常请求
    ("/api/market/stocks?dashboard=true", "正常Dashboard请求"),
    
    # 可能触发错误的请求
    ("/api/market/stocks?symbols=INVALID_SYMBOL", "无效股票代码"),
    ("/api/market/stocks?symbols=AAPL,MSFT,GOOGL,TSLA,NVDA,AMZN,META,JPM,JNJ,V,INVALID", "混合有效和无效代码"),
    ("/api/market/stocks?dashboard=invalid", "无效dashboard参数"),
    
    # 其他可能接口
    ("/api/market/stock/INVALID", "无效单股详情"),
    ("/api/market/history/INVALID", "无效历史数据"),
]

print("尝试触发500错误...")

for endpoint, description in test_cases:
    url = f"{base_url}{endpoint}"
    print(f"\n=== 测试: {description} ===")
    print(f"URL: {url}")
    
    try:
        response = requests.get(url, timeout=10)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 500:
            print(f"❌ 成功触发500错误！")
            print(f"响应: {response.text[:500]}")
            
            # 尝试解析错误信息
            try:
                error_data = response.json()
                print(f"JSON错误: {json.dumps(error_data, indent=2)}")
            except:
                print(f"原始错误: {response.text}")
        elif response.status_code == 200:
            print(f"✅ 请求成功")
            try:
                data = response.json()
                print(f"响应结构: {list(data.keys()) if isinstance(data, dict) else type(data)}")
            except:
                print(f"响应: {response.text[:200]}")
        else:
            print(f"响应: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 请求失败: {e}")