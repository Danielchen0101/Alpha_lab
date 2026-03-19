#!/usr/bin/env python3
"""
触发API调用测试
"""

import requests
import json
import time

def trigger_api_test():
    """触发API调用"""
    print("触发API调用测试")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 触发普通Market页调用
        print("触发普通Market页API调用...")
        symbols = 'AAPL'
        response = requests.get(f"{base_url}/market/stocks?symbols={symbols}", timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            print(f"API调用成功")
            print(f"请查看后端控制台日志，确认:")
            print(f"  1. Finnhub quote API返回的原始数据")
            print(f"  2. 是否有'h'或'high'字段")
            print(f"  3. 是否有'l'或'low'字段")
        else:
            print(f"API调用失败: {response.status_code}")
            
    except Exception as e:
        print(f"测试异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    trigger_api_test()