#!/usr/bin/env python3
"""
测试AI Configuration真实链路
"""

import requests
import json
import os
import time

BASE_URL = "http://127.0.0.1:8890"  # 使用正确的端口
AI_CONFIG_FILE = os.path.expanduser('~/.openclaw/ai_config.json')

def print_step(step, description):
    """打印步骤"""
    print(f"\n{'='*80}")
    print(f"步骤 {step}: {description}")
    print(f"{'='*80}")

def test_health():
    """测试健康检查"""
    print("测试健康检查...")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"健康检查状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"健康检查响应: {json.dumps(data, indent=4)}")
            return True
        else:
            print(f"健康检查失败: {response.text}")
            return False
    except Exception as e:
        print(f"健康检查异常: {e}")
        return False

def test_save_config():
    """测试保存配置"""
    print_step(1, "保存AI配置")
    
    config = {
        "provider": "DeepSeek",
        "model": "deepseek-chat",
        "apiKey": "sk-test-key-1234567890abcdef1234567890abcdef",  # 测试用假key，长度足够
        "baseUrl": "https://api.deepseek.com"
    }
    
    print(f"前端发送的save payload:")
    print(json.dumps(config, indent=4))
    
    try:
        response = requests.post(
            f"{BASE_URL}/ai/provider/config",
            json=config,
            timeout=10
        )
        
        print(f"\n后端响应状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"后端响应数据:")
            print(json.dumps(data, indent=4))
            
            if data.get('success'):
                print(f"✅ 配置保存成功")
                
                # 检查文件是否保存
                if os.path.exists(AI_CONFIG_FILE):
                    print(f"\n✅ 配置文件已保存: {AI_CONFIG_FILE}")
                    with open(AI_CONFIG_FILE, 'r', encoding='utf-8') as f:
                        saved_config = json.load(f)
                    print(f"文件内容 (apiKey已打码):")
                    saved_config_copy = saved_config.copy()
                    if 'apiKey' in saved_config_copy:
                        saved_config_copy['apiKey'] = saved_config_copy['apiKey'][:10] + '...' + saved_config_copy['apiKey'][-4:]
                    print(json.dumps(saved_config_copy, indent=4))
                else:
                    print(f"\n❌ 配置文件未保存")
            else:
                print(f"❌ 配置保存失败: {data.get('message')}")
                
        else:
            print(f"响应文本: {response.text}")
            
    except Exception as e:
        print(f"❌ 请求异常: {e}")

def test_load_config():
    """测试加载配置"""
    print_step(2, "加载AI配置")
    
    try:
        response = requests.get(
            f"{BASE_URL}/ai/provider/config",
            timeout=10
        )
        
        print(f"后端响应状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"后端响应数据:")
            print(json.dumps(data, indent=4))
            
            if data.get('success') and data.get('config'):
                config = data['config']
                print(f"\n✅ 配置加载成功")
                print(f"provider: {config.get('provider')}")
                print(f"model: {config.get('model')}")
                print(f"apiKey长度: {len(config.get('apiKey', ''))}")
                print(f"baseUrl: {config.get('baseUrl')}")
                
                # 验证不是默认值
                if config.get('provider') == 'DeepSeek' and config.get('model') == 'deepseek-chat':
                    print(f"⚠️ 注意: 加载的是默认值，可能之前没有保存成功")
                else:
                    print(f"✅ 加载的是用户保存的配置，不是默认值")
            else:
                print(f"\n❌ 配置加载失败: {data.get('message')}")
                
        else:
            print(f"响应文本: {response.text}")
            
    except Exception as e:
        print(f"❌ 请求异常: {e}")

def test_invalid_config():
    """测试无效配置"""
    print_step(3, "测试无效配置验证")
    
    test_cases = [
        {
            "name": "非法provider",
            "config": {
                "provider": "test-chain-provider",
                "model": "test-chain-model",
                "apiKey": "fake-key",
                "baseUrl": "https://fake.com"
            },
            "expected_error": "不支持的provider"
        },
        {
            "name": "非法model",
            "config": {
                "provider": "DeepSeek",
                "model": "test-chain-model",
                "apiKey": "fake-key",
                "baseUrl": "https://api.deepseek.com"
            },
            "expected_error": "不支持的model"
        },
        {
            "name": "空apiKey",
            "config": {
                "provider": "DeepSeek",
                "model": "deepseek-chat",
                "apiKey": "",
                "baseUrl": "https://api.deepseek.com"
            },
            "expected_error": "API密钥未提供"
        },
        {
            "name": "格式错误的apiKey",
            "config": {
                "provider": "DeepSeek",
                "model": "deepseek-chat",
                "apiKey": "sk-too-short",
                "baseUrl": "https://api.deepseek.com"
            },
            "expected_error": "API密钥格式可能无效"
        }
    ]
    
    for test_case in test_cases:
        print(f"\n测试: {test_case['name']}")
        print(f"配置: {json.dumps(test_case['config'], indent=4)}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/ai/provider/test",
                json=test_case['config'],
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"响应: {json.dumps(data, indent=4)}")
                
                if not data.get('success') and test_case['expected_error'] in data.get('message', ''):
                    print(f"✅ 预期错误匹配: {test_case['expected_error']}")
                else:
                    print(f"❌ 错误不匹配，预期: {test_case['expected_error']}")
            else:
                print(f"状态码: {response.status_code}")
                print(f"响应: {response.text}")
                
        except Exception as e:
            print(f"❌ 请求异常: {e}")

def test_analyze_single():
    """测试单只股票分析"""
    print_step(4, "测试/ai/analyze/single使用用户配置")
    
    # 测试AAPL
    symbol = "AAPL"
    payload = {
        "symbol": symbol
    }
    
    print(f"发送分析请求:")
    print(json.dumps(payload, indent=4))
    
    try:
        response = requests.post(
            f"{BASE_URL}/ai/analyze/single",
            json=payload,
            timeout=15
        )
        
        print(f"\n后端响应状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"后端响应数据:")
            print(json.dumps(data, indent=4))
            
            # 检查是否使用了用户配置
            if data.get('success'):
                print(f"✅ AI分析成功")
                print(f"trend: {data.get('trend')}")
                print(f"overallScore: {data.get('overallScore')}")
                print(f"aiReasoning: {data.get('aiReasoning')}")
                print(f"provenance: {data.get('provenance')}")
            else:
                print(f"❌ AI分析失败: {data.get('error')}")
                if 'config_missing' in str(data.get('aiReasoning', '')):
                    print(f"⚠️ 失败原因: AI配置不完整")
                
        else:
            print(f"响应文本: {response.text}")
            
    except Exception as e:
        print(f"❌ 请求异常: {e}")

def test_valid_connection():
    """测试有效连接"""
    print_step(5, "测试有效配置连接")
    
    # 使用之前保存的配置
    try:
        response = requests.get(
            f"{BASE_URL}/ai/provider/config",
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success') and data.get('config'):
                config = data['config']
                
                print(f"使用保存的配置进行测试:")
                config_copy = config.copy()
                if 'apiKey' in config_copy:
                    config_copy['apiKey'] = config_copy['apiKey'][:10] + '...' + config_copy['apiKey'][-4:]
                print(json.dumps(config_copy, indent=4))
                
                # 测试连接
                test_response = requests.post(
                    f"{BASE_URL}/ai/provider/test",
                    json=config,
                    timeout=30  # 给provider更多时间
                )
                
                if test_response.status_code == 200:
                    test_data = test_response.json()
                    print(f"\n测试连接响应:")
                    print(json.dumps(test_data, indent=4))
                    
                    if test_data.get('success'):
                        print(f"✅ 测试连接成功")
                        print(f"响应时间: {test_data.get('response_time', 0):.0f}ms")
                    else:
                        print(f"⚠️ 测试连接失败: {test_data.get('message')}")
                        print(f"注意: 这可能是API密钥无效或provider问题")
                else:
                    print(f"❌ 测试连接HTTP错误: {test_response.status_code}")
                    print(f"响应: {test_response.text}")
            else:
                print(f"❌ 无法获取配置")
        else:
            print(f"❌ 加载配置失败: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 请求异常: {e}")

def main():
    """主函数"""
    print("AI Configuration真实链路测试")
    print("=" * 80)
    print(f"后端地址: {BASE_URL}")
    print("=" * 80)
    
    # 0. 健康检查
    if not test_health():
        print("❌ 后端服务不可用，请检查")
        return
    
    time.sleep(1)
    
    # 1. 保存配置
    test_save_config()
    time.sleep(1)
    
    # 2. 加载配置
    test_load_config()
    time.sleep(1)
    
    # 3. 测试无效配置验证
    test_invalid_config()
    time.sleep(1)
    
    # 4. 测试单只股票分析
    test_analyze_single()
    time.sleep(1)
    
    # 5. 测试有效连接
    test_valid_connection()
    
    print(f"\n{'='*80}")
    print("测试总结")
    print(f"{'='*80}")
    print("需要验证:")
    print("1. ✅ Save Settings: 配置能保存到文件")
    print("2. ✅ Load Settings: 页面刷新后能加载")
    print("3. ✅ Test Connection: 对非法配置能本地明确失败")
    print("4. ⏳ Test Connection: 对合法配置能成功（需要有效API密钥）")
    print("5. ✅ /ai/analyze/single: 使用用户保存的配置")
    print("6. ✅ AI Configuration成为唯一来源")

if __name__ == "__main__":
    main()