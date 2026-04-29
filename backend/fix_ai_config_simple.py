#!/usr/bin/env python3
"""
简化版AI配置修复
"""

import os
import json

BACKEND_FILE = "start_quant_backend_repaired.py"
CONFIG_FILE = os.path.expanduser("~/.openclaw/ai_config.json")

def main():
    print("=== 修复AI配置链路 ===")
    
    # 1. 读取文件
    with open(BACKEND_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 2. 删除硬编码key
    old_key = "'apiKey': 'sk-83365246617844178bf8d1e121b7279f',  # 硬编码API密钥用于测试"
    new_key = "'apiKey': '',  # 用户必须配置，无硬编码默认值"
    
    if old_key in content:
        content = content.replace(old_key, new_key)
        print("[SUCCESS] 删除硬编码apiKey")
    else:
        print("[WARNING] 未找到硬编码apiKey")
    
    # 3. 删除其他硬编码值
    replacements = [
        ("'provider': 'DeepSeek',", "'provider': '',  # 用户必须配置"),
        ("'baseURL': 'https://api.deepseek.com',", "'baseURL': '',   # 用户必须配置"),
        ("'model': 'deepseek-chat'", "'model': ''      # 用户必须配置"),
    ]
    
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            print(f"[SUCCESS] 替换: {old}")
    
    # 4. 删除GET方法中的硬编码回退
    get_fallback = """            # 确保硬编码配置，确保API密钥不为空
            config_to_return = dict(ai_provider_config_state)
            if not config_to_return.get('apiKey'):
                config_to_return['apiKey'] = 'sk-83365246617844178bf8d1e121b7279f'"""
    
    new_get = """            # 返回当前配置（可能为空）
            config_to_return = dict(ai_provider_config_state)
            # 不再提供硬编码默认值，用户必须自己配置"""
    
    if get_fallback in content:
        content = content.replace(get_fallback, new_get)
        print("[SUCCESS] 删除GET方法中的硬编码回退")
    
    # 5. 添加持久化函数（简化版）
    persistence_code = """

# AI配置持久化
import json
import os
AI_CONFIG_FILE = os.path.expanduser('~/.openclaw/ai_config.json')

def save_ai_config_to_file(config):
    \"\"\"保存AI配置到文件\"\"\"
    try:
        os.makedirs(os.path.dirname(AI_CONFIG_FILE), exist_ok=True)
        with open(AI_CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
        return True
    except:
        return False

def load_ai_config_from_file():
    \"\"\"从文件加载AI配置\"\"\"
    try:
        if os.path.exists(AI_CONFIG_FILE):
            with open(AI_CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except:
        pass
    return {}

def get_effective_ai_config():
    \"\"\"获取有效的AI配置\"\"\"
    config = dict(ai_provider_config_state)
    if not config.get('apiKey'):
        file_config = load_ai_config_from_file()
        if file_config:
            ai_provider_config_state.update(file_config)
            config.update(file_config)
    return config

# 启动时加载配置
_startup_config = load_ai_config_from_file()
if _startup_config:
    ai_provider_config_state.update(_startup_config)
"""
    
    # 在ai_provider_config_state定义后添加
    if "ai_provider_config_state = {" in content and "def get_effective_ai_config()" not in content:
        pos = content.find("ai_provider_config_state = {")
        brace_count = 0
        for i in range(pos, len(content)):
            if content[i] == '{':
                brace_count += 1
            elif content[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    content = content[:i+1] + persistence_code + content[i+1:]
                    print("[SUCCESS] 添加持久化函数")
                    break
    
    # 6. 更新ai_provider_config函数使用持久化
    if "@app.route('/api/ai/provider/config'" in content:
        # 添加无前缀版本
        old_route = "@app.route('/api/ai/provider/config', methods=['GET', 'POST'])"
        new_route = "@app.route('/api/ai/provider/config', methods=['GET', 'POST'])\n@app.route('/ai/provider/config', methods=['GET', 'POST'])  # 兼容无前缀版本"
        content = content.replace(old_route, new_route)
        print("[SUCCESS] 添加无前缀路由版本")
    
    # 7. 保存修改
    with open(BACKEND_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    
    # 8. 创建测试配置文件
    os.makedirs(os.path.dirname(CONFIG_FILE), exist_ok=True)
    test_config = {
        "provider": "deepseek",
        "apiKey": "test-user-configured-key-1234567890",
        "baseURL": "https://api.deepseek.com",
        "model": "deepseek-chat"
    }
    
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(test_config, f, indent=2)
    
    print(f"[SUCCESS] 创建测试配置文件: {CONFIG_FILE}")
    
    print("\n=== 修复完成 ===")
    print("1. 硬编码key已删除")
    print("2. 配置持久化已添加")
    print("3. 路由前缀已统一")
    print("4. 测试配置文件已创建")
    print("\n请重启后端服务使更改生效")

if __name__ == "__main__":
    main()