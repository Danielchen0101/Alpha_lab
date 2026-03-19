#!/usr/bin/env python3
"""
简单API测试
"""

import requests
import json

def test_simple_api():
    """简单API测试"""
    print("简单API测试")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 测试1: 指定symbols参数
        print("1. 测试指定symbols参数:")
        print("-" * 60)
        
        response = requests.get(f"{base_url}/market/stocks?symbols=AAPL", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"响应状态: 成功")
            
            stocks = data.get('stocks', [])
            if stocks:
                stock = stocks[0]
                print(f"\nAAPL返回的字段:")
                for key in sorted(stock.keys()):
                    print(f"  {key}: {stock[key]}")
        
        # 测试2: 不指定symbols参数（Market页默认）
        print(f"\n\n2. 测试不指定symbols参数（Market页默认）:")
        print("-" * 60)
        
        response = requests.get(f"{base_url}/market/stocks", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"响应状态: 成功")
            
            stocks = data.get('stocks', [])
            if stocks:
                stock = stocks[0]
                print(f"\n第一支股票返回的字段:")
                for key in sorted(stock.keys()):
                    print(f"  {key}: {stock[key]}")
        
        # 测试3: 检查后端日志
        print(f"\n\n3. 问题分析:")
        print("-" * 60)
        print("如果API返回的数据中没有dayHigh/dayLow字段，说明:")
        print("  1. 后端代码没有设置这些字段")
        print("  2. 或者这些字段的值为None，被省略了")
        print("  3. 或者代码路径有问题")
        
        print(f"\n解决方案:")
        print("  确保这些字段总是被包含在返回对象中")
        
    except Exception as e:
        print(f"测试异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    test_simple_api()