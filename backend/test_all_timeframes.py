"""
测试所有时间范围的Finnhub数据
"""

import requests
import json
from datetime import datetime

def test_timeframe(symbol, interval, range_param, label):
    """测试特定时间范围"""
    print(f"\n{'='*60}")
    print(f"测试 {label}")
    print(f"{'='*60}")
    
    base_url = "http://127.0.0.1:8889"
    
    print(f"参数: interval={interval}, range={range_param}")
    
    try:
        response = requests.get(
            f"{base_url}/api/market/history/{symbol}",
            params={
                "interval": interval,
                "range": range_param
            },
            timeout=30
        )
        
        print(f"响应状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            data_points = data.get('data', [])
            
            print(f"数据源: {data.get('source', 'unknown')}")
            print(f"数据点数量: {len(data_points)}")
            print(f"消息: {data.get('message', '')}")
            
            if len(data_points) > 0:
                first = data_points[0]
                last = data_points[-1]
                
                if first.get('timestamp'):
                    dt_first = datetime.fromtimestamp(first.get('timestamp'))
                    print(f"第一个点: {dt_first.strftime('%Y-%m-%d %H:%M:%S')} - 价格: {first.get('close')}")
                
                if last.get('timestamp'):
                    dt_last = datetime.fromtimestamp(last.get('timestamp'))
                    print(f"最后一个点: {dt_last.strftime('%Y-%m-%d %H:%M:%S')} - 价格: {last.get('close')}")
                
                # 验证
                if len(data_points) > 1:
                    print(f"[SUCCESS] {label}: {len(data_points)}个真实数据点")
                else:
                    print(f"[WARNING] {label}: 只有{len(data_points)}个数据点")
            
        elif response.status_code == 500:
            data = response.json()
            print(f"[ERROR] {label}: Finnhub API错误")
            print(f"错误: {data.get('error', 'unknown error')}")
            print(f"数据源: {data.get('source', 'unknown')}")
        else:
            print(f"[ERROR] {label}: HTTP {response.status_code}")
            
    except Exception as e:
        print(f"[ERROR] {label}: {type(e).__name__}: {str(e)}")

def test_all_timeframes():
    """测试所有时间范围"""
    print("=" * 60)
    print("测试所有时间范围的Finnhub数据")
    print("=" * 60)
    
    symbol = "AAPL"
    
    # 测试所有时间范围
    timeframes = [
        ("60", "1day", "1 Day (60分钟)"),
        ("D", "1day", "1 Day (日线)"),
        ("60", "1week", "1 Week (60分钟)"),
        ("D", "1week", "1 Week (日线)"),
        ("D", "1month", "1 Month (日线)"),
        ("D", "3month", "3 Months (日线)"),
        ("D", "1year", "1 Year (日线)"),
    ]
    
    for interval, range_param, label in timeframes:
        test_timeframe(symbol, interval, range_param, label)
    
    print(f"\n{'='*60}")
    print("测试完成")
    print(f"{'='*60}")

if __name__ == "__main__":
    test_all_timeframes()