#!/usr/bin/env python3
"""
直接运行后端并测试
"""

import subprocess
import time
import requests
import sys
import os

# 启动后端
print("启动后端服务器...")
backend_process = subprocess.Popen(
    [sys.executable, "start_quant_backend.py"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True,
    encoding='utf-8'
)

# 等待后端启动
print("等待后端启动...")
time.sleep(3)

try:
    # 测试单股详情接口
    print("\n=== 测试单股详情接口 ===")
    try:
        response = requests.get("http://127.0.0.1:8889/api/market/stock/AAPL", timeout=10)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text}")
    except Exception as e:
        print(f"请求失败: {e}")
    
    # 测试列表接口
    print("\n=== 测试列表接口 ===")
    try:
        response = requests.get("http://127.0.0.1:8889/api/market/stocks", timeout=10)
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"股票数量: {data.get('count')}")
            print(f"数据源: {data.get('source')}")
    except Exception as e:
        print(f"请求失败: {e}")
        
finally:
    # 停止后端
    print("\n停止后端服务器...")
    backend_process.terminate()
    backend_process.wait()
    
    # 输出后端日志
    print("\n=== 后端输出 ===")
    stdout, stderr = backend_process.communicate()
    if stdout:
        print("标准输出:")
        print(stdout[:2000])  # 只打印前2000字符
    if stderr:
        print("错误输出:")
        print(stderr[:2000])