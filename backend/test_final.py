import requests
import json

def test_api():
    try:
        # 测试普通Market请求
        print("=== 测试普通Market请求 ===")
        response = requests.get("http://127.0.0.1:8889/api/market/stocks", timeout=10)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"响应结构顶层keys: {list(data.keys())}")
            print(f"股票数量: {data.get('count')}")
            print(f"数据源: {data.get('source')}")
            print(f"成功: {data.get('success')}")
            print(f"时间戳: {data.get('timestamp')}")
            print(f"耗时: {data.get('elapsed')}秒")
            stocks = data.get('stocks', [])
            print(f"股票列表: {len(stocks)}支")
            
            # 打印前3支股票
            for i, stock in enumerate(stocks[:3]):
                print(f"  股票{i+1}: {stock.get('symbol')} - {stock.get('name')} - ${stock.get('price')}")
        else:
            print(f"错误: {response.text}")
        
        print("\n=== 测试带symbols参数的请求 ===")
        response2 = requests.get("http://127.0.0.1:8889/api/market/stocks?symbols=AAPL,MSFT", timeout=10)
        print(f"状态码: {response2.status_code}")
        
        if response2.status_code == 200:
            data2 = response2.json()
            print(f"响应结构顶层keys: {list(data2.keys())}")
            print(f"股票数量: {data2.get('count')}")
        
        print("\n=== 测试Dashboard请求 ===")
        response3 = requests.get("http://127.0.0.1:8889/api/market/stocks?dashboard=true", timeout=10)
        print(f"状态码: {response3.status_code}")
        
        if response3.status_code == 200:
            data3 = response3.json()
            print(f"响应结构顶层keys: {list(data3.keys())}")
            print(f"股票数量: {data3.get('count')}")
            
    except Exception as e:
        print(f"测试失败: {e}")

if __name__ == "__main__":
    test_api()