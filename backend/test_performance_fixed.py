"""
测试优化后的Dashboard性能
"""

import requests
import time
import json

def test_dashboard_performance():
    """测试Dashboard数据请求性能"""
    print("=" * 80)
    print("Dashboard性能测试 - 优化后")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    
    # 测试1: Dashboard请求（轻量级模式）
    print("\n1. 测试Dashboard请求（轻量级模式）:")
    print("-" * 40)
    
    start_time = time.time()
    try:
        response = requests.get(
            f"{base_url}/api/market/stocks",
            params={"dashboard": "true"},
            timeout=35  # 稍微超过30秒
        )
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 请求成功！耗时: {elapsed:.2f}秒")
            print(f"   股票数量: {data.get('count', 0)}")
            print(f"   数据源: {data.get('source', 'Unknown')}")
            print(f"   缓存命中: {'timestamp' in data}")
            
            # 检查数据完整性
            stocks = data.get('stocks', [])
            if stocks:
                sample = stocks[0]
                print(f"\n   样本数据检查:")
                print(f"     Symbol: {sample.get('symbol')}")
                print(f"     Price: {sample.get('price')}")
                print(f"     Change %: {sample.get('changePercent')}")
                print(f"     Market Cap: {sample.get('marketCap')}")
                print(f"     Sector: {sample.get('sector')}")
                
                # 检查是否缺少非关键字段（轻量级模式可能没有）
                missing_fields = []
                for field in ['peRatio', 'dividendYield', 'yearHigh', 'yearLow']:
                    if field not in sample or sample[field] is None:
                        missing_fields.append(field)
                
                if missing_fields:
                    print(f"     ⚠️  轻量级模式缺少字段: {missing_fields}")
                else:
                    print(f"     ✅ 所有字段完整")
        else:
            print(f"❌ 请求失败！状态码: {response.status_code}")
            print(f"   响应: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        elapsed = time.time() - start_time
        print(f"❌ 请求超时！耗时超过35秒")
        print(f"   实际耗时: {elapsed:.2f}秒")
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"❌ 请求异常: {type(e).__name__}: {str(e)}")
        print(f"   耗时: {elapsed:.2f}秒")
    
    # 测试2: 完整模式请求（对比）
    print("\n2. 测试完整模式请求（对比）:")
    print("-" * 40)
    
    start_time = time.time()
    try:
        response = requests.get(
            f"{base_url}/api/market/stocks",
            timeout=35
        )
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 请求成功！耗时: {elapsed:.2f}秒")
            print(f"   股票数量: {data.get('count', 0)}")
            
            # 检查数据完整性
            stocks = data.get('stocks', [])
            if stocks:
                sample = stocks[0]
                print(f"\n   样本数据检查:")
                print(f"     Symbol: {sample.get('symbol')}")
                print(f"     PE Ratio: {sample.get('peRatio')}")
                print(f"     Dividend Yield: {sample.get('dividendYield')}")
                print(f"     52W High: {sample.get('yearHigh')}")
                print(f"     52W Low: {sample.get('yearLow')}")
        else:
            print(f"❌ 请求失败！状态码: {response.status_code}")
            
    except requests.exceptions.Timeout:
        elapsed = time.time() - start_time
        print(f"❌ 请求超时！耗时超过35秒")
        print(f"   实际耗时: {elapsed:.2f}秒")
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"❌ 请求异常: {type(e).__name__}: {str(e)}")
        print(f"   耗时: {elapsed:.2f}秒")
    
    # 测试3: 缓存测试
    print("\n3. 测试缓存效果:")
    print("-" * 40)
    
    for i in range(3):
        print(f"\n   第{i+1}次请求:")
        start_time = time.time()
        try:
            response = requests.get(
                f"{base_url}/api/market/stocks",
                params={"dashboard": "true"},
                timeout=10
            )
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                print(f"     ✅ 耗时: {elapsed:.2f}秒")
                print(f"        股票数量: {data.get('count', 0)}")
            else:
                print(f"     ❌ 失败: {response.status_code}")
                
        except Exception as e:
            print(f"     ❌ 异常: {type(e).__name__}")
    
    print("\n" + "=" * 80)
    print("性能测试完成")
    print("=" * 80)

if __name__ == "__main__":
    test_dashboard_performance()