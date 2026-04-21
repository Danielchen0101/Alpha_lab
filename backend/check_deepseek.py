#!/usr/bin/env python3
"""
检查DeepSeek API配置
"""

import requests
import json
import os
import re

def test_api_key(api_key, base_url="https://api.deepseek.com", model="deepseek-chat"):
    """测试API密钥"""
    print(f"测试API密钥: {api_key[:10]}... (长度: {len(api_key)})")
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    
    payload = {
        'model': model,
        'messages': [{'role': 'user', 'content': 'Test'}],
        'max_tokens': 10
    }
    
    try:
        response = requests.post(
            f'{base_url}/chat/completions',
            headers=headers,
            json=payload,
            timeout=10
        )
        
        print(f"  状态码: {response.status_code}")
        
        if response.status_code == 200:
            print("  [OK] API密钥有效")
            return True
        elif response.status_code == 401:
            print("  [FAIL] API密钥无效 (401)")
            return False
        else:
            print(f"  [FAIL] 其他错误: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"  [FAIL] 异常: {str(e)}")
        return False

def main():
    """主函数"""
    print("DeepSeek API配置检查")
    print("="*60)
    
    # 1. 检查配置文件
    print("\n1. 检查配置文件 ai_provider_config.json:")
    config_file = 'ai_provider_config.json'
    config_key = None
    
    if os.path.exists(config_file):
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        config_key = config.get('apiKey')
        print(f"   找到配置文件:")
        print(f"     Provider: {config.get('provider')}")
        print(f"     API密钥: {config_key[:10]}... (长度: {len(config_key)})")
        print(f"     Base URL: {config.get('baseURL')}")
        print(f"     Model: {config.get('model')}")
    else:
        print("   [FAIL] 配置文件不存在")
    
    # 2. 检查硬编码密钥
    print("\n2. 检查代码中的硬编码密钥:")
    hardcoded_key = None
    
    try:
        with open('start_quant_backend_fixed.py', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 查找硬编码密钥
        pattern = r"'apiKey'\s*:\s*'([^']+)'"
        matches = re.findall(pattern, content)
        
        for key in matches:
            if key.startswith('sk-'):
                hardcoded_key = key
                print(f"   找到硬编码API密钥: {key[:10]}... (长度: {len(key)})")
                break
                
        if not hardcoded_key:
            print("   [FAIL] 未找到硬编码API密钥")
            
    except Exception as e:
        print(f"   [FAIL] 读取文件错误: {str(e)}")
    
    # 3. 测试密钥
    print("\n3. 测试API密钥:")
    
    if config_key:
        print(f"   测试配置文件密钥:")
        config_valid = test_api_key(config_key)
    else:
        print("   [FAIL] 配置文件中没有API密钥")
        config_valid = False
    
    if hardcoded_key:
        print(f"\n   测试硬编码密钥:")
        hardcoded_valid = test_api_key(hardcoded_key)
    else:
        hardcoded_valid = False
    
    # 4. 分析结果
    print("\n" + "="*60)
    print("分析结果:")
    print("="*60)
    
    if config_valid:
        print("[OK] 配置文件中的API密钥有效")
        print("     建议: 使用配置文件中的密钥")
    elif config_key and not config_valid:
        print("[FAIL] 配置文件中的API密钥无效")
    
    if hardcoded_valid:
        print("[OK] 硬编码API密钥有效")
    elif hardcoded_key and not hardcoded_valid:
        print("[FAIL] 硬编码API密钥无效")
        print("     这是当前后端使用的密钥，导致401错误")
    
    # 5. 修复建议
    print("\n" + "="*60)
    print("修复建议:")
    print("="*60)
    
    if config_valid:
        print("1. 修改后端代码，从配置文件读取API密钥")
        print("2. 移除硬编码的无效密钥")
        print("3. 重启后端服务")
    else:
        print("1. 获取有效的DeepSeek API密钥")
        print("2. 更新配置文件 ai_provider_config.json")
        print("3. 修改后端代码使用配置文件")
        print("4. 移除硬编码的无效密钥")
        print("5. 重启后端服务")

if __name__ == '__main__':
    main()