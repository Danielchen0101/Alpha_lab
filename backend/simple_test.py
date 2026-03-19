import requests
import json
import time

print("启动后端并测试...")

# 先确保后端停止
import os
os.system("taskkill /F /IM python.exe 2>nul")

# 启动后端
import subprocess
proc = subprocess.Popen(["py", "quant_backend.py"], 
                       stdout=subprocess.PIPE, 
                       stderr=subprocess.PIPE)

print("等待后端启动...")
time.sleep(5)

try:
    # 测试API
    print("\n测试 /api/market/stocks:")
    response = requests.get("http://127.0.0.1:8889/api/market/stocks", timeout=