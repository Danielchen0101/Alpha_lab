#!/usr/bin/env python3
"""
简单测试Finnhub历史数据接口
"""

import requests
import time
import sys
from datetime import datetime

def test_timeframe(timeframe_name, interval, range_param):
    """测试单个timeframe"""
    print(f"\n=== 测试 {timeframe_name} ===")
    print(f"请求参数: interval={interval}, range={range_param}")
    
    url = f"http://localhost:8889/api/market/history/AAPL"
    params = {
        'interval': interval,
        'range': range_param
    }
    
    print(f"请求URL: {url}")
    print(f"请求参数: {params}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code != 200:
            print(f"  - 错误: HTTP {response.status_code}")
            print(f"  - 响应: {response.text[:200]}")
            return
        
        data = response.json()
        
        print(f"  - dataSource: {data.get('dataSource', 'N/A')}")
        print(f"  - count: {data.get('count', 0)}")
        print(f"  - interval: {data.get('interval', 'N/A')}")
        print(f"  - range: {data.get('range', 'N/A')}")
        
        if 'error' in data:
            print(f"  - 错误: {data['error']}")
            return
        
        data_list = data.get('data', [])
        if len(data_list) > 0:
            first = data_list[0]
            last = data_list[-1]
            
            print(f"  - 第一条数据:")
            print(f"    - time: {first.get('time', 'N/A')}")
            print(f"    - open: {first.get('open', 'N/A')}")
            print(f"    - close: {first.get('close', 'N/A')}")
            print(f"    - volume: {first.get('volume', 'N/A')}")
            
            print(f"  - 最后一条数据:")
            print(f"    - time: {last.get('time', 'N/A')}")
            print(f"    - open: {last.get('open', 'N/A')}")
            print(f"    - close: {last.get('close', 'N/A')}")
            print(f"    - volume: {last.get('volume', 'N/A')}")
            
            # 计算时间跨度
            try:
                first_time = datetime.fromisoformat(first['time'].replace('Z', '+00:00'))
                last_time = datetime.fromisoformat(last['time'].replace('Z', '+00:00'))
                time_diff = last_time - first_time
                print(f"  - 时间跨度: {time_diff.days}天 {time_diff.seconds//3600}小时 {(time_diff.seconds%3600)//60}分钟")
            except:
                print(f"  - 时间跨度: 无法计算")
        else:
            print(f"  - 警告: 无数据返回")
            
    except requests.exceptions.ConnectionError:
        print(f"  - 错误: 无法连接到后端服务")
    except Exception as e:
        print(f"  - 异常: {e}")

def main():
    print("=== 测试Finnhub历史数据接口 ===")
    
    # 检查后端是否在运行
    try:
        health_check = requests.get("http://localhost:8889/api/health", timeout=5)
        if health_check.status_code == 200:
            print("后端服务正在运行")
        else:
            print(f"后端服务异常: HTTP {health_check.status_code}")
            return
    except requests.exceptions.ConnectionError:
        print("错误: 后端服务未运行")
        print("请先启动后端服务: python start_quant_backend.py")
        return
    
    # 测试所有timeframe
    test_timeframe("1 Day", "5min", "1day")
    test_timeframe("1 Week", "1day", "1week")
    test_timeframe("1 Month", "1day", "1month")
    test_timeframe("3 Months", "1day", "3month")
    test_timeframe("1 Year", "1day", "1year")
    
    print("\n=== 测试完成 ===")

if __name__ == "__main__":
    main()