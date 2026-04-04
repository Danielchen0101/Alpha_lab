#!/usr/bin/env python3
"""
简单测试 broker 代理接口
"""

import sys
import os

# 添加后端目录到路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# 导入 Flask 应用
from start_quant_backend import app

# 测试路由
with app.test_client() as client:
    print("测试 /api/broker/account:")
    response = client.get('/api/broker/account')
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.get_data(as_text=True)[:200]}")
    
    print("\n测试 /api/broker/positions:")
    response = client.get('/api/broker/positions')
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.get_data(as_text=True)[:200]}")
    
    print("\n测试 /api/broker/orders:")
    response = client.get('/api/broker/orders')
    print(f"状态码: {response.status_code}")
    print(f"响应: {response.get_data(as_text=True)[:200]}")