#!/usr/bin/env python3
"""
测试Twelve Data API和后端处理
"""

import requests
import json

# Twelve Data API密钥
TWELVEDATA_API_KEY = '3541c054d16843cb8e4b2ccefa456a01'

def test_twelvedata_direct():
    """直接测试Twelve Data API"""
    print("=== 直接测试Twelve Data API ===")
    
    url = "https://api.twelvedata.com/time_series"
    params = {
        'symbol': 'AAPL',
        'interval': '1day',
        'outputsize': 10,
        'apikey': TWELVEDATA_API_KEY,
        'format': 'JSON'
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        print(f"状态码: {response.status_code}")
        print(f"响应状态: {data.get('status', 'unknown')}")
        print(f"响应键: {list(data.keys())}")
        
        # 检查不同大小写的字段
        print(f"'values' in data: {'values' in data}")
        print(f"'Values' in data: {'Values' in data}")
        print(f"'data' in data: {'data' in data}")
        print(f"'Data' in data: {'Data' in data}")
        
        if 'values' in data:
            values = data['values']
            print(f"values数量: {len(values)}")
            if len(values) > 0:
                print(f"第一个数据点: {values[0]}")
        
        return True
    except Exception as e:
        print(f"Twelve Data API测试失败: {e}")
        return False

def test_backend_api():
    """测试后端API"""
    print("\n=== 测试后端API ===")
    
    # 测试1: 1 Month数据 (interval=D, range=1month)
    url = "http://localhost:8889/api/market/history/AAPL"
    params = {
        'interval': 'D',
        'range': '1month'
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        print(f"后端状态码: {response.status_code}")
        print(f"数据源: {data.get('dataSource', '未知')}")
        print(f"数据点数: {data.get('count', 0)}")
        print(f"是否有数据字段: {'data' in data}")
        
        if 'data' in data:
            data_points = data['data']
            print(f"数据数组长度: {len(data_points)}")
            if len(data_points) > 0:
                print(f"第一个数据点: {data_points[0]}")
        
        return True
    except Exception as e:
        print(f"后端API测试失败: {e}")
        return False

def test_interval_mapping():
    """测试interval映射"""
    print("\n=== 测试interval映射 ===")
    
    # 模拟后端的映射逻辑
    interval_map = {
        '30': '30min',
        '60': '1h',
        'D': '1day'
    }
    
    test_cases = [
        ('30', '30min'),
        ('60', '1h'),
        ('D', '1day'),
        ('1day', '1day'),  # 直接传递
        ('1h', '1h'),      # 直接传递
    ]
    
    for input_interval, expected in test_cases:
        if input_interval in interval_map:
            mapped = interval_map[input_interval]
        else:
            # 使用默认映射
            if input_interval == '30min':
                mapped = '30min'
            elif input_interval == '1h':
                mapped = '1h'
            elif input_interval == '1day':
                mapped = '1day'
            else:
                mapped = '1h'  # 默认
        
        print(f"输入: {input_interval} -> 映射: {mapped} (期望: {expected}) {'OK' if mapped == expected else 'FAIL'}")

if __name__ == "__main__":
    print("开始测试Twelve Data问题...")
    
    # 测试直接API
    test_twelvedata_direct()
    
    # 测试映射
    test_interval_mapping()
    
    # 测试后端API（如果后端在运行）
    try:
        test_backend_api()
    except:
        print("后端未运行，跳过后端测试")
    
    print("\n测试完成！")