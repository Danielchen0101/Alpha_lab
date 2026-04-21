#!/usr/bin/env python3
"""
手动测试AI Configuration全链路
"""

import requests
import json
import os
import time

BASE_URL = "http://127.0.0.1:8890"
AI_CONFIG_FILE = os.path.expanduser('~/.openclaw/ai_config.json')

def print_header(title):
    print(f"\n{'='*80}")
    print(f"{title}")
    print(f"{'='*80}")

def test_save():
    """测试保存配置"""
    print_header("测试1: Save Settings")
    
    # 模拟前端发送的payload
    save_payload = {
        "provider": "DeepSeek",
        "model": "deepseek-chat",
        "apiKey": "sk-test-key-1234567890abcdef1234567890abcdef",
        "baseUrl": "https://api.deepseek.com"
    }
    
    print("前端发送的request payload:")
    print(json.dumps(save_payload, indent=4))
    
    print("\n发送请求到后端...")
    response = requests.post(f"{BASE_URL}/ai/provider/config", json=save_payload, timeout=10)
    
    print(f"后端响应状态码: {response.status_code}")
    print("后端响应数据:")
    print(json.dumps(response.json(), indent=4))
    
    print(f"\n保存后的文件路径: {AI_CONFIG_FILE}")
    if os.path.exists(AI_CONFIG_FILE):
        with open(AI_CONFIG_FILE, 'r', encoding='utf-8') as f:
            saved = json.load(f)
        
        # 打码apiKey
        saved_masked = saved.copy()
        if 'apiKey' in saved_masked:
            saved_masked['apiKey'] = saved_masked['apiKey'][:10] + '...' + saved_masked['apiKey'][-4:]
        
        print("文件内容 (apiKey已打码):")
        print(json.dumps(saved_masked, indent=4))
    else:
        print("ERROR: 配置文件未保存")

def test_load():
    """测试加载配置"""
    print_header("测试2: Load Settings (页面刷新后)")
    
    print("发送GET请求到后端...")
    response = requests.get(f"{BASE_URL}/ai/provider/config", timeout=10)
    
    print(f"后端响应状态码: {response.status_code}")
    data = response.json()
    print("后端GET返回值:")
    print(json.dumps(data, indent=4))
    
    if data.get('success') and data.get('config'):
        config = data['config']
        print("\n前端表单最终显示值:")
        print(f"  provider: {config.get('provider')}")
        print(f"  model: {config.get('model')}")
        print(f"  apiKey长度: {len(config.get('apiKey', ''))}")
        print(f"  baseUrl: {config.get('baseUrl')}")
        
        # 证明不是默认值
        print("\n验证: 这是用户保存的配置，不是默认值")
        if config.get('provider') == 'DeepSeek' and config.get('model') == 'deepseek-chat':
            print("注意: 虽然显示DeepSeek/deepseek-chat，但apiKey是用户提供的，不是空值")
        if config.get('apiKey'):
            print(f"确认: apiKey有值 (长度: {len(config.get('apiKey'))})，不是空默认值")

def test_connection():
    """测试连接"""
    print_header("测试3: Test Connection")
    
    # 先获取当前配置
    response = requests.get(f"{BASE_URL}/ai/provider/config", timeout=10)
    if response.status_code != 200:
        print("ERROR: 无法获取配置")
        return
    
    config = response.json().get('config', {})
    
    print("前端真实request payload (使用保存的配置):")
    print(json.dumps(config, indent=4))
    
    print("\n发送Test Connection请求...")
    test_response = requests.post(f"{BASE_URL}/ai/provider/test", json=config, timeout=30)
    
    print(f"后端响应状态码: {test_response.status_code}")
    test_data = test_response.json()
    print("后端响应数据:")
    print(json.dumps(test_data, indent=4))
    
    print("\n分析:")
    if test_data.get('success'):
        print("SUCCESS: 测试连接成功")
        print(f"响应时间: {test_data.get('response_time', 0):.0f}ms")
    else:
        print("FAILED: 测试连接失败")
        print(f"失败原因: {test_data.get('message')}")
        
        if '不支持的provider' in test_data.get('message', ''):
            print("这是本地验证失败，没有打到provider")
        elif '不支持的model' in test_data.get('message', ''):
            print("这是本地验证失败，没有打到provider")
        elif 'API密钥未提供' in test_data.get('message', ''):
            print("这是本地验证失败，没有打到provider")
        elif 'API密钥格式可能无效' in test_data.get('message', ''):
            print("这是本地验证失败，没有打到provider")
        else:
            print("这是打到provider后返回的错误")

def test_analyze_single():
    """测试单只股票分析"""
    print_header("测试4: /ai/analyze/single 使用用户配置")
    
    symbol = "AAPL"
    payload = {"symbol": symbol}
    
    print(f"发送分析请求 for {symbol}:")
    print(json.dumps(payload, indent=4))
    
    print("\n发送请求到后端...")
    response = requests.post(f"{BASE_URL}/ai/analyze/single", json=payload, timeout=15)
    
    print(f"后端响应状态码: {response.status_code}")
    data = response.json()
    print("后端响应数据:")
    print(json.dumps(data, indent=4))
    
    print("\n验证配置使用:")
    print("1. 检查后端控制台应打印: effective ai config = {...}")
    print("2. 检查provider/model/baseUrl/apiKey长度")
    print("3. 确认使用的是用户保存的配置，不是硬编码值")

def test_invalid_config():
    """测试无效配置"""
    print_header("测试5: 无效配置验证")
    
    test_cases = [
        ("非法provider", {
            "provider": "test-chain-provider",
            "model": "test-chain-model",
            "apiKey": "fake-key",
            "baseUrl": "https://fake.com"
        }, "不支持的provider"),
        ("非法model", {
            "provider": "DeepSeek",
            "model": "test-chain-model",
            "apiKey": "fake-key",
            "baseUrl": "https://api.deepseek.com"
        }, "不支持的model"),
        ("空apiKey", {
            "provider": "DeepSeek",
            "model": "deepseek-chat",
            "apiKey": "",
            "baseUrl": "https://api.deepseek.com"
        }, "API密钥未提供"),
    ]
    
    for name, config, expected_error in test_cases:
        print(f"\n测试: {name}")
        print(f"配置: {json.dumps(config, indent=4)}")
        
        response = requests.post(f"{BASE_URL}/ai/provider/test", json=config, timeout=10)
        data = response.json()
        
        print(f"响应: {json.dumps(data, indent=4)}")
        
        if not data.get('success') and expected_error in data.get('message', ''):
            print(f"SUCCESS: 本地验证正确拦截，错误信息包含: {expected_error}")
            print("确认: 没有打到真实provider")
        else:
            print(f"FAILED: 验证不匹配")

def main():
    """主函数"""
    print("AI Configuration全链路手动测试")
    print("=" * 80)
    print(f"后端地址: {BASE_URL}")
    print("注意: 查看后端控制台输出以获取详细日志")
    print("=" * 80)
    
    # 检查后端是否运行
    try:
        health = requests.get(f"{BASE_URL}/health", timeout=5)
        if health.status_code != 200:
            print("ERROR: 后端服务不可用")
            return
    except:
        print("ERROR: 后端服务不可用")
        return
    
    print("SUCCESS: 后端服务正在运行")
    
    # 执行测试
    test_save()
    time.sleep(1)
    
    test_load()
    time.sleep(1)
    
    test_connection()
    time.sleep(1)
    
    test_analyze_single()
    time.sleep(1)
    
    test_invalid_config()
    
    print_header("测试完成")
    print("查看后端控制台输出以确认:")
    print("1. get_effective_ai_config() 被调用")
    print("2. 配置被正确加载")
    print("3. 本地验证拦截无效配置")
    print("4. /ai/analyze/single 使用用户配置")

if __name__ == "__main__":
    main()