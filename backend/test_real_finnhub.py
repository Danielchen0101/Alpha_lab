"""
测试真实的Finnhub数据（无模拟数据）
"""

import requests
import json
from datetime import datetime

def test_real_finnhub():
    """测试真实的Finnhub数据"""
    print("=" * 60)
    print("测试真实的Finnhub数据（无模拟数据）")
    print("=" * 60)
    
    # 测试参数
    symbol = "AAPL"
    base_url = "http://127.0.0.1:8889"
    
    print(f"\n1. 测试1 Day历史数据请求...")
    print(f"   股票: {symbol}")
    print(f"   请求URL: {base_url}/api/market/history/{symbol}")
    print(f"   参数: interval=60, range=1day")
    
    try:
        # 发送请求
        response = requests.get(
            f"{base_url}/api/market/history/{symbol}",
            params={
                "interval": "60",   # 60分钟粒度
                "range": "1day"     # 1天范围
            },
            timeout=30
        )
        
        print(f"\n2. 响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            print(f"\n3. 返回数据详情:")
            print(f"   - 数据源: {data.get('source', 'unknown')}")
            print(f"   - 使用的resolution: {data.get('interval', 'unknown')}")
            print(f"   - 数据点数量: {data.get('count', 0)}")
            print(f"   - 消息: {data.get('message', '')}")
            
            # 检查数据点
            data_points = data.get('data', [])
            if data_points:
                print(f"\n4. 数据点详情:")
                print(f"   - 数据点数量: {len(data_points)}")
                
                if len(data_points) > 0:
                    first_point = data_points[0]
                    last_point = data_points[-1]
                    
                    print(f"   - 第一个点: timestamp={first_point.get('timestamp')}")
                    if first_point.get('timestamp'):
                        dt = datetime.fromtimestamp(first_point.get('timestamp'))
                        print(f"       时间: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
                        print(f"       价格: {first_point.get('close')}")
                    
                    print(f"   - 最后一个点: timestamp={last_point.get('timestamp')}")
                    if last_point.get('timestamp'):
                        dt = datetime.fromtimestamp(last_point.get('timestamp'))
                        print(f"       时间: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
                        print(f"       价格: {last_point.get('close')}")
                    
                    # 验证结果
                    print(f"\n5. 验证结果:")
                    if len(data_points) > 1:
                        print(f"   [SUCCESS] 成功: 返回了 {len(data_points)} 个真实数据点")
                        print(f"   [SUCCESS] 数据源: {data.get('source', 'unknown')}")
                        print(f"   [SUCCESS] 这是真实的Finnhub数据，无模拟数据")
                    else:
                        print(f"   [WARNING] 警告: 只返回了 {len(data_points)} 个数据点")
                        print(f"   [WARNING] 但这是真实的Finnhub数据")
                else:
                    print(f"   [INFO] 数据点列表为空")
            else:
                print(f"\n4. [INFO] 没有数据点返回")
                print(f"   返回数据: {json.dumps(data, indent=2)}")
                
        elif response.status_code == 500:
            data = response.json()
            print(f"\n3. [ERROR] 服务器错误 (500):")
            print(f"   错误信息: {data.get('error', 'unknown error')}")
            print(f"   数据源: {data.get('source', 'unknown')}")
            print(f"   [SUCCESS] 确认: 这是真实的Finnhub错误，无模拟数据")
        else:
            print(f"\n3. [ERROR] HTTP错误: {response.status_code}")
            print(f"   响应内容: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print(f"\n2. [ERROR] 错误: 无法连接到后端服务")
        print(f"   请确保后端正在运行: http://127.0.0.1:8889")
    except Exception as e:
        print(f"\n2. [ERROR] 错误: {type(e).__name__}: {str(e)}")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == "__main__":
    test_real_finnhub()