"""
立即测试Dashboard marketCap数据
"""

import requests
import json
import time

def test_dashboard_marketcap():
    """测试Dashboard marketCap数据"""
    print("=" * 80)
    print("Dashboard marketCap数据测试 - 实时")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889"
    
    # 测试Dashboard请求（轻量级模式）
    print("\n1. 测试Dashboard请求（轻量级模式）:")
    print("-" * 40)
    
    start_time = time.time()
    try:
        response = requests.get(
            f"{base_url}/api/market/stocks",
            params={"dashboard": "true"},
            timeout=30
        )
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 请求成功！耗时: {elapsed:.2f}秒")
            print(f"   股票数量: {data.get('count', 0)}")
            print(f"   数据源: {data.get('source', 'Unknown')}")
            
            stocks = data.get('stocks', [])
            if stocks:
                print(f"\n2. 检查marketCap数据:")
                print("-" * 40)
                
                # 计算总市值
                total_market_cap = 0
                valid_market_caps = []
                
                for i, stock in enumerate(stocks):
                    symbol = stock.get('symbol', 'N/A')
                    market_cap = stock.get('marketCap')
                    
                    if market_cap is not None:
                        total_market_cap += market_cap
                        valid_market_caps.append((symbol, market_cap))
                        
                        # 显示前5只股票
                        if i < 5:
                            # 格式化显示
                            if market_cap >= 1e12:
                                formatted = f"${market_cap/1e12:.2f}T"
                            elif market_cap >= 1e9:
                                formatted = f"${market_cap/1e9:.2f}B"
                            elif market_cap >= 1e6:
                                formatted = f"${market_cap/1e6:.2f}M"
                            else:
                                formatted = f"${market_cap}"
                            
                            print(f"   {symbol:<6} marketCap: {market_cap:,.0f} → {formatted}")
                
                print(f"\n3. 汇总统计:")
                print("-" * 40)
                print(f"   有效marketCap数据: {len(valid_market_caps)}/{len(stocks)}")
                print(f"   总市值: {total_market_cap:,.0f} 美元")
                
                # 格式化总市值
                if total_market_cap >= 1e12:
                    formatted_total = f"${total_market_cap/1e12:.2f}T"
                elif total_market_cap >= 1e9:
                    formatted_total = f"${total_market_cap/1e9:.2f}B"
                elif total_market_cap >= 1e6:
                    formatted_total = f"${total_market_cap/1e6:.2f}M"
                else:
                    formatted_total = f"${total_market_cap}"
                
                print(f"   格式化: {formatted_total}")
                
                # 检查是否显示为T级别
                if "T" in formatted_total:
                    print(f"   ✅ 总市值显示为T级别（正确）")
                elif "M" in formatted_total and total_market_cap > 1e12:
                    print(f"   ❌ 问题：总市值应该显示为T级别，但显示为M级别")
                    print(f"      可能原因：marketCap值太小，单位转换有问题")
                
                # 找出最大市值股票
                if valid_market_caps:
                    largest = max(valid_market_caps, key=lambda x: x[1])
                    symbol, market_cap = largest
                    
                    if market_cap >= 1e12:
                        formatted_largest = f"${market_cap/1e12:.2f}T"
                    elif market_cap >= 1e9:
                        formatted_largest = f"${market_cap/1e9:.2f}B"
                    elif market_cap >= 1e6:
                        formatted_largest = f"${market_cap/1e6:.2f}M"
                    else:
                        formatted_largest = f"${market_cap}"
                    
                    print(f"\n4. 最大市值股票:")
                    print(f"   {symbol}: {market_cap:,.0f} 美元 → {formatted_largest}")
                    
                    if "T" in formatted_largest:
                        print(f"   ✅ 最大市值显示为T级别（正确）")
                    elif "M" in formatted_largest and market_cap > 1e12:
                        print(f"   ❌ 问题：最大市值应该显示为T级别，但显示为M级别")
        else:
            print(f"❌ 请求失败！状态码: {response.status_code}")
            print(f"   响应: {response.text[:200]}")
            
    except Exception as e:
        print(f"❌ 请求异常: {type(e).__name__}: {str(e)}")
    
    print("\n" + "=" * 80)
    print("测试完成")
    print("=" * 80)

if __name__ == "__main__":
    test_dashboard_marketcap()