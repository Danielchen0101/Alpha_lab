#!/usr/bin/env python3
"""
添加调试日志测试
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8889"

def test_with_real_deepseek_key():
    """使用真实的DeepSeek key测试（如果有）"""
    print("=== 使用测试配置测试 ===")
    
    # 测试配置 - 使用截图中的配置
    test_config = {
        "provider": "DeepSeek",
        "apiKey": "sk-47f47112ba5744899172296fcc6ff2c7",  # 截图中的key
        "baseUrl": "https://api.deepseek.com",
        "model": "deepseek-chat"
    }
    
    print(f"测试配置: {json.dumps(test_config, indent=4)}")
    print(f"API Key长度: {len(test_config['apiKey'])}")
    print(f"API Key前缀: {test_config['apiKey'][:10]}...")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/provider/test",
            json=test_config,
            timeout=15
        )
        
        print(f"\nHTTP状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"响应JSON: {json.dumps(data, indent=4)}")
            
            # 分析响应
            if data.get('success'):
                print("✅ Test Connection成功!")
            else:
                print(f"❌ Test Connection失败: {data.get('message')}")
                
                # 检查失败原因
                message = data.get('message', '')
                if '401' in message:
                    print("  原因: API密钥无效或过期 (401)")
                elif '400' in message:
                    print("  原因: API请求参数错误 (400)")
                elif '429' in message:
                    print("  原因: 速率限制 (429)")
                elif 'timeout' in message.lower():
                    print("  原因: 连接超时")
                else:
                    print(f"  原因: {message}")
        else:
            print(f"响应文本: {response.text[:500]}")
            
    except requests.exceptions.Timeout:
        print("⏱️ 请求超时")
    except Exception as e:
        print(f"❌ 异常: {e}")

def test_with_different_payloads():
    """测试不同的payload格式"""
    print("\n=== 测试不同的payload格式 ===")
    
    test_cases = [
        {
            "name": "标准格式",
            "payload": {
                "provider": "DeepSeek",
                "apiKey": "sk-test-key-12345678901234567890",
                "baseUrl": "https://api.deepseek.com",
                "model": "deepseek-chat"
            }
        },
        {
            "name": "大写baseURL",
            "payload": {
                "provider": "DeepSeek",
                "apiKey": "sk-test-key-12345678901234567890",
                "baseURL": "https://api.deepseek.com",  # 大写
                "model": "deepseek-chat"
            }
        },
        {
            "name": "缺少model",
            "payload": {
                "provider": "DeepSeek",
                "apiKey": "sk-test-key-12345678901234567890",
                "baseUrl": "https://api.deepseek.com"
            }
        },
        {
            "name": "自定义provider",
            "payload": {
                "provider": "CustomProvider",
                "apiKey": "sk-test-key-12345678901234567890",
                "baseUrl": "https://api.custom.com",
                "model": "custom-model"
            }
        }
    ]
    
    for test_case in test_cases:
        print(f"\n测试: {test_case['name']}")
        print(f"  Payload: {json.dumps(test_case['payload'], indent=4)}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/ai/provider/test",
                json=test_case['payload'],
                timeout=10
            )
            
            print(f"  状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"  响应: {json.dumps(data, indent=4)}")
            else:
                print(f"  响应文本: {response.text[:200]}")
                
        except Exception as e:
            print(f"  异常: {e}")

def analyze_backend_validation():
    """分析后端验证逻辑"""
    print("\n=== 分析后端验证逻辑 ===")
    
    # 从之前的测试看，后端代码的关键验证是：
    # if not api_key or api_key.startswith('sk-') and len(api_key) < 30:
    
    print("后端验证逻辑:")
    print("1. 检查apiKey是否为空")
    print("2. 检查apiKey是否以'sk-'开头且长度<30")
    print("3. 如果上述条件成立，返回: 'API 密钥无效或未提供'")
    print("4. 否则，尝试调用配置的API")
    print("\n问题: 这个验证可能太严格了!")
    print("  有些有效的API key可能以'sk-'开头且长度<30")
    print("  或者用户可能使用其他格式的API key")

def check_what_frontend_sends():
    """检查前端实际发送的内容"""
    print("\n=== 检查前端实际发送的内容 ===")
    
    # 从前端代码看，handleTestConnection构建的config是:
    print("前端handleTestConnection构建的config:")
    print("  provider: values.provider || 'DeepSeek'")
    print("  model: values.model || 'deepseek-chat'")
    print("  apiKey: values.apiKey || ''")
    print("  baseUrl: values.baseUrl || 'https://api.deepseek.com'")
    
    print("\n如果用户留空表单，前端会发送:")
    empty_config = {
        "provider": "DeepSeek",  # 默认值
        "model": "deepseek-chat",  # 默认值
        "apiKey": "",  # 空字符串
        "baseUrl": "https://api.deepseek.com"  # 默认值
    }
    print(f"  {json.dumps(empty_config, indent=4)}")
    
    print("\n这个配置会被后端拒绝，因为apiKey为空!")
    print("后端返回: 'API 密钥无效或未提供'")

def main():
    """主函数"""
    print("=" * 60)
    print("Test Connection 400错误深度分析")
    print("=" * 60)
    
    # 使用截图中的配置测试
    test_with_real_deepseek_key()
    
    # 测试不同payload格式
    test_with_different_payloads()
    
    # 分析后端验证逻辑
    analyze_backend_validation()
    
    # 检查前端实际发送的内容
    check_what_frontend_sends()
    
    print("\n" + "=" * 60)
    print("结论")
    print("=" * 60)
    print("1. ❌ 问题不是HTTP 400状态码，而是响应消息中的'API 测试失败: 400'")
    print("2. ✅ 后端路由工作正常（返回200状态码）")
    print("3. 🔍 后端调用用户配置的API，该API返回了400错误")
    print("4. 📝 后端将API的400错误包装在响应消息中返回")
    print("\n可能的原因:")
    print("A. API密钥无效或过期")
    print("B. API请求参数错误（provider/model/baseUrl不匹配）")
    print("C. 配置的API端点不接受测试请求")
    print("D. 网络问题或防火墙阻止")
    print("\n建议:")
    print("1. 检查后端ai_provider_test函数，添加更多调试日志")
    print("2. 检查实际发送到第三方API的请求")
    print("3. 考虑放宽API key验证逻辑")
    print("4. 提供更详细的错误信息")

if __name__ == "__main__":
    main()