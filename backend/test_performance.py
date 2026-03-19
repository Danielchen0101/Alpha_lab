"""
测试Dashboard数据请求性能
"""

import requests
import time
import json

def test_dashboard_performance():
    """测试Dashboard数据请求性能"""
    print("=" * 80)
    print("Dashboard性能测试")
    print("=" * 80)
    
    base_url = "http://127.0