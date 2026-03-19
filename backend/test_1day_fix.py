"""
测试1 Day修复是否生效
直接调用后端API验证返回的数据
"""

import requests
import json
import time
from datetime import datetime

def test_1day_fix():
    """测试1 Day历史数据修复"""
    print("=" * 60)
    print("测试1 Day修复是否生效")
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
                print(f"   - 第一个点: timestamp={data_points[0].get('timestamp')} ({datetime.fromtimestamp(data_points[0].get('timestamp')) if data_points[0].get('timestamp') else 'N/A'})")
                print(f"   - 最后一个点: timestamp={data_points[-1].get('timestamp')} ({datetime.fromtimestamp(data_points[-1].get('timestamp')) if data_points[-1].get('timestamp') else 'N/A'})")
                print(f"   - 时间范围: {datetime.fromtimestamp(data_points[0].get('timestamp')) if data_points[0].get('timestamp') else 'N/A'} 到 {datetime.fromtimestamp(data_points[-1].get('timestamp')) if data_points[-1].get('timestamp') else 'N/A'}")
                
                # 打印所有数据点的时间
                print(f"\n5. 所有数据点时间:")
                for i, point in enumerate(data_points[:10]):  # 只显示前10个
                    ts = point.get('timestamp')
                    if ts:
                        time_str = datetime.fromtimestamp(ts).strftime('%Y-%m-%d %H:%M:%S')
                        print(f"   [{i+1}] {time_str} - 收盘价: {point.get('close')}")
                
                if len(data_points) > 10:
                    print(f"   ... 还有 {len(data_points) - 10} 个数据点")
                
                # 验证结果
                print(f"\n6. 验证结果:")
                if len(data_points) > 1:
                    print(f"   [SUCCESS] 成功: 返回了 {len(data_points)} 个数据点")
                    print(f"   [SUCCESS] x轴应该显示多个时间点，不再只有 00:00")
                    
                    # 检查时间是否合理（应该是日内时间）
                    first_time = data_points[0].get('timestamp')
                    if first_time:
                        dt = datetime.fromtimestamp(first_time)
                        hour = dt.hour
                        minute = dt.minute
                        
                        if hour >= 9 and hour <= 16:
                            print(f"   [SUCCESS] 时间合理: 第一个点在交易时间内 ({dt.strftime('%H:%M')})")
                        else:
                            print(f"   [WARNING] 警告: 第一个点不在正常交易时间 ({dt.strftime('%H:%M')})")
                else:
                    print(f"   [FAILURE] 失败: 只返回了 {len(data_points)} 个数据点")
                    print(f"   [FAILURE] x轴可能仍然只有 00:00")
                    
            else:
                print(f"\n4. [ERROR] 错误: 没有返回数据点")
                print(f"   返回数据: {json.dumps(data, indent=2)}")
                
        else:
            print(f"\n3. [ERROR] 错误: HTTP {response.status_code}")
            print(f"   响应内容: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print(f"\n2. [ERROR] 错误: 无法连接到后端服务")
        print(f"   请确保后端正在运行: http://127.0.0.1:8889")
        print(f"   运行命令: cd backend && python quant_backend.py")
    except Exception as e:
        print(f"\n2. [ERROR] 错误: {type(e).__name__}: {str(e)}")
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

if __name__ == "__main__":
    # 等待后端启动
    print("等待后端启动...")
    time.sleep(3)
    
    test_1day_fix()