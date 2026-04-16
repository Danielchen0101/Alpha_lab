#!/usr/bin/env python3
"""
调试配置问题
"""

import os
import json
import requests

BASE_URL = "http://127.0.0.1:8889"
CONFIG_FILE = os.path.expanduser("~/.openclaw/ai_config.json")

def debug_config_issue():
    """调试配置问题"""
    print("=== 调试配置问题 ===")
    
    # 1. 首先查看当前配置文件
    print("\n1. 当前配置文件内容:")
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            config = json.load(f)
        print(f"   {json.dumps(config, indent=2)}")
    else:
        print("   配置文件不存在")
    
    # 2. 通过API获取配置
    print("\n2. 通过API获取配置:")
    try:
        response = requests.get(f"{BASE_URL}/api/ai/provider/config", timeout=5)
        if response.status_code == 200:
            data = response.json()
            config = data.get('config', {})
            print(f"   API返回配置: {json.dumps(config, indent=2)}")
            
            # 检查是否有硬编码key
            api_key = config.get('apiKey', '')
            if api_key == 'sk-83365246617844178bf8d1e121b7279f':
                print("   ⚠️ 发现硬编码key!")
            elif api_key:
                print(f"   Key类型: {api_key[:20]}...")
            else:
                print("   Key为空")
        else:
            print(f"   API失败: {response.status_code}")
    except Exception as e:
        print(f"   API异常: {e}")
    
    # 3. 清空配置测试
    print("\n3. 清空配置测试:")
    try:
        # 保存空配置
        empty_config = {
            "provider": "",
            "apiKey": "",
            "baseUrl": "",
            "model": ""
        }
        
        response = requests.post(f"{BASE_URL}/api/ai/provider/config", json=empty_config, timeout=5)
        print(f"   清空配置响应: {response.status_code}")
        
        if response.status_code == 200:
            print(f"   清空配置结果: {response.json()}")
            
            # 重新获取配置
            response2 = requests.get(f"{BASE_URL}/api/ai/provider/config", timeout=5)
            if response2.status_code == 200:
                data = response2.json()
                config = data.get('config', {})
                print(f"   重新获取配置: {json.dumps(config, indent=2)}")
    except Exception as e:
        print(f"   清空配置异常: {e}")
    
    # 4. 检查后端文件中的硬编码
    print("\n4. 检查后端文件中的硬编码:")
    backend_file = "start_quant_backend_repaired.py"
    
    with open(backend_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 搜索硬编码key
    hardcoded_patterns = [
        "sk-83365246617844178bf8d1e121b7279f",
        "'apiKey': 'sk-",
        'apiKey": "sk-',
        "apiKey = 'sk-",
        'apiKey = "sk-'
    ]
    
    found = False
    for pattern in hardcoded_patterns:
        if pattern in content:
            print(f"   发现模式: {pattern}")
            found = True
            
            # 显示上下文
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if pattern in line:
                    print(f"     第{i+1}行: {line.strip()}")
    
    if not found:
        print("   未发现硬编码key模式")
    
    # 5. 检查get_effective_ai_config函数
    print("\n5. 检查get_effective_ai_config函数:")
    if "def get_effective_ai_config()" in content:
        # 提取函数内容
        start = content.find("def get_effective_ai_config():")
        end = content.find("def ", start + 1)
        if end == -1:
            end = len(content)
        
        func_content = content[start:end]
        print("   函数内容:")
        for line in func_content.split('\n')[:20]:
            print(f"     {line}")
    else:
        print("   未找到get_effective_ai_config函数")

if __name__ == "__main__":
    debug_config_issue()