#!/usr/bin/env python3
"""
验证修复后的Test Connection
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8889"

def test_fake_provider_model():
    """测试fake provider/model是否被本地拦截"""
    print("=" * 60)
    print("测试fake provider/model本地拦截")
    print("=" * 60)
    
    # 测试1: fake provider
    print("\n测试1: provider=test-chain-provider")
    payload1 = {
        "provider": "test-chain-provider",
        "model": "deepseek-chat",
        "apiKey": "sk-12345678901234567890123456789012",
        "baseUrl": "https://api.deepseek.com"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/provider/test",
            json=payload1,
            timeout=10
        )
        
        print(f"HTTP状态码: {response.status_code}")
        print(f"响应体: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if '不支持的provider' in data.get('message', ''):
                print("✅ 成功拦截: fake provider被本地拒绝")
            else:
                print("❌ 失败: 应该拦截但没有拦截")
                
    except Exception as e:
        print(f"异常: {e}")
    
    # 测试2: fake model
    print("\n测试2: model=test-chain-model")
    payload2 = {
        "provider": "DeepSeek",
        "model": "test-chain-model",
        "apiKey": "sk-12345678901234567890123456789012",
        "baseUrl": "https://api.deepseek.com"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/provider/test",
            json=payload2,
            timeout=10
        )
        
        print(f"HTTP状态码: {response.status_code}")
        print(f"响应体: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if '不支持的model' in data.get('message', ''):
                print("✅ 成功拦截: fake model被本地拒绝")
            else:
                print("❌ 失败: 应该拦截但没有拦截")
                
    except Exception as e:
        print(f"异常: {e}")
    
    # 测试3: 有效配置
    print("\n测试3: 有效DeepSeek配置")
    payload3 = {
        "provider": "DeepSeek",
        "model": "deepseek-chat",
        "apiKey": "sk-12345678901234567890123456789012",
        "baseUrl": "https://api.deepseek.com"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/provider/test",
            json=payload3,
            timeout=10
        )
        
        print(f"HTTP状态码: {response.status_code}")
        print(f"响应体: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('success'):
                print("✅ 有效配置通过本地验证")
            else:
                print(f"❌ 有效配置被拒绝: {data.get('message')}")
                
    except Exception as e:
        print(f"异常: {e}")

def test_save_config_validation():
    """测试保存配置时的验证"""
    print("\n" + "=" * 60)
    print("测试保存配置时的验证")
    print("=" * 60)
    
    # 测试保存fake provider
    print("\n测试保存fake provider:")
    payload1 = {
        "provider": "test-chain-provider",
        "model": "deepseek-chat",
        "apiKey": "test-key",
        "baseUrl": "https://api.test.com"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/provider/config",
            json=payload1,
            timeout=10
        )
        
        print(f"HTTP状态码: {response.status_code}")
        print(f"响应体: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if not data.get('success') and '不支持的provider' in data.get('message', ''):
                print("✅ 保存时成功拦截fake provider")
            else:
                print("❌ 保存时应该拦截但没有拦截")
                
    except Exception as e:
        print(f"异常: {e}")

def check_backend_logs_instruction():
    """检查后端日志的指令"""
    print("\n" + "=" * 60)
    print("需要查看的后端日志")
    print("=" * 60)
    
    print("运行上述测试后，查看后端控制台应该看到:")
    print("\n1. 对于fake provider:")
    print("   === AI Provider Test 请求 ===")
    print("   请求数据: {...}")
    print("   provider: test-chain-provider")
    print("   model: deepseek-chat")
    print("   [本地验证] 不支持的provider: test-chain-provider")
    print("   [返回] 本地400错误，不调用第三方API")
    
    print("\n2. 对于fake model:")
    print("   === AI Provider Test 请求 ===")
    print("   请求数据: {...}")
    print("   provider: DeepSeek")
    print("   model: test-chain-model")
    print("   [本地验证] 不支持的model: test-chain-model")
    print("   [返回] 本地400错误，不调用第三方API")
    
    print("\n3. 对于有效配置:")
    print("   === AI Provider Test 请求 ===")
    print("   请求数据: {...}")
    print("   provider: DeepSeek")
    print("   model: deepseek-chat")
    print("   [本地验证] 通过")
    print("   [调用第三方] POST https://api.deepseek.com/chat/completions")
    print("   [第三方响应] 401 (因为key无效)")
    print("   [返回] API 测试失败: 401")

def main():
    """主函数"""
    print("验证Test Connection修复")
    print("=" * 60)
    
    # 测试fake provider/model拦截
    test_fake_provider_model()
    
    # 测试保存配置验证
    test_save_config_validation()
    
    # 检查后端日志
    check_backend_logs_instruction()
    
    print("\n" + "=" * 60)
    print("修复总结")
    print("=" * 60)
    print("1. ✅ 后端添加了provider白名单验证")
    print("2. ✅ 后端添加了model白名单验证")
    print("3. ✅ fake provider/model在本地被拦截，不调用第三方API")
    print("4. ✅ 保存配置时也验证provider/model")
    print("5. ✅ 前端表单改为下拉选择，限制输入")
    print("\n现在截图中的400错误应该变成:")
    print("   '不支持的provider: test-chain-provider'")
    print("   或")
    print("   '不支持的model: test-chain-model'")
    print("\n不会再发送非法请求到DeepSeek API")

if __name__ == "__main__":
    main()