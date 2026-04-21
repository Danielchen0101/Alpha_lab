#!/usr/bin/env python3
"""
直接捕获证据
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8889"

def capture_all_evidence():
    """捕获所有证据"""
    print("=" * 80)
    print("直接捕获Test Connection 400错误的硬证据")
    print("=" * 80)
    
    # 证据1: 前端发送的payload
    print("\n1. 前端发送的payload（根据截图推测）:")
    frontend_payload = {
        "provider": "test-chain-provider",
        "model": "test-chain-model",
        "apiKey": "sk-47f47112ba5744899172296fcc6ff2c7",
        "baseUrl": "https://api.deepseek.com"
    }
    print(json.dumps(frontend_payload, indent=4))
    
    # 证据2: 发送请求
    print("\n2. 发送请求到后端...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/provider/test",
            json=frontend_payload,
            timeout=20
        )
        
        print(f"HTTP状态码: {response.status_code}")
        print(f"响应体: {response.text}")
        
        # 解析响应
        if response.status_code == 200:
            data = response.json()
            print(f"\n3. 后端返回的响应:")
            print(f"   success: {data.get('success')}")
            print(f"   valid: {data.get('valid')}")
            print(f"   message: {data.get('message')}")
            
            # 分析错误类型
            message = data.get('message', '')
            if '400' in message:
                print(f"\n4. 错误分析: 400错误")
                print("   这意味着: provider返回了400错误")
                print("   需要查看后端控制台获取:")
                print("   - 后端接收到的实际payload")
                print("   - 后端发送到provider的请求")
                print("   - provider返回的具体错误信息")
            elif '401' in message:
                print(f"\n4. 错误分析: 401错误")
                print("   这意味着: API密钥无效")
            elif 'API 密钥无效' in message:
                print(f"\n4. 错误分析: 本地验证失败")
                print("   这意味着: 后端本地验证拒绝")
            else:
                print(f"\n4. 错误分析: 其他错误")
                
        else:
            print(f"异常HTTP状态码: {response.status_code}")
            print(f"响应文本: {response.text}")
            
    except Exception as e:
        print(f"请求异常: {e}")

def analyze_backend_logic():
    """分析后端逻辑"""
    print("\n" + "=" * 80)
    print("后端逻辑分析")
    print("=" * 80)
    
    print("当前后端代码的问题:")
    print("1. 没有验证provider是否受支持")
    print("2. 没有验证model是否有效")
    print("3. 直接使用用户提供的值调用第三方API")
    print("4. 硬编码请求路径为/chat/completions")
    
    print("\n对于截图中的payload:")
    print("provider: test-chain-provider")
    print("model: test-chain-model")
    print("baseUrl: https://api.deepseek.com")
    
    print("\n后端会构建请求:")
    print("URL: https://api.deepseek.com/chat/completions")
    print("Headers: Authorization: Bearer sk-47f47112ba5744899172296fcc6ff2c7")
    print("Body: {\"model\": \"test-chain-model\", \"messages\": [...]}")
    
    print("\nDeepSeek API可能返回:")
    print("1. 400: 非法model (test-chain-model不是有效模型)")
    print("2. 401: API密钥无效")
    print("3. 其他错误")

def what_we_need_from_backend_logs():
    """我们需要从后端日志获取什么"""
    print("\n" + "=" * 80)
    print("需要后端控制台输出的硬证据")
    print("=" * 80)
    
    print("后端调试代码会打印:")
    print("\n1. 接收到的请求:")
    print("   === AI Provider Test 请求 ===")
    print("   请求数据: {...}")
    print("   解析的apiKey: sk-47f4711... (长度: 35)")
    print("   provider: test-chain-provider")
    print("   baseUrl: https://api.deepseek.com")
    print("   baseURL: null")
    print("   model: test-chain-model")
    
    print("\n2. 发送到provider的请求:")
    print("   测试URL: https://api.deepseek.com/chat/completions")
    print("   测试payload: {\"model\": \"test-chain-model\", ...}")
    print("   请求头Authorization: Bearer sk-47f4711...")
    
    print("\n3. Provider的响应:")
    print("   API测试失败，状态码: 400 (或401)")
    print("   API响应头: {...}")
    print("   API响应文本: {...具体错误信息...}")
    
    print("\n4. 根据响应文本判断:")
    print("   - 如果是\"Invalid model\": model问题")
    print("   - 如果是\"Invalid API key\": key问题")
    print("   - 如果是其他错误: 请求格式问题")

def suggest_fixes():
    """建议修复"""
    print("\n" + "=" * 80)
    print("建议的修复")
    print("=" * 80)
    
    print("1. 添加provider验证:")
    print("   SUPPORTED_PROVIDERS = ['DeepSeek', 'OpenAI', 'Claude']")
    print("   if provider not in SUPPORTED_PROVIDERS:")
    print("       return error('不支持的provider')")
    
    print("\n2. 添加model验证:")
    print("   PROVIDER_MODELS = {")
    print("       'DeepSeek': ['deepseek-chat', 'deepseek-coder'],")
    print("       'OpenAI': ['gpt-4', 'gpt-3.5-turbo']")
    print("   }")
    print("   if model not in PROVIDER_MODELS.get(provider, []):")
    print("       return error('不支持的model')")
    
    print("\n3. 改进错误信息:")
    print("   不要只返回状态码，要解析provider的错误信息")
    print("   提供具体的修复建议")

def main():
    """主函数"""
    capture_all_evidence()
    analyze_backend_logic()
    what_we_need_from_backend_logs()
    suggest_fixes()
    
    print("\n" + "=" * 80)
    print("最终需要你查看后端控制台并告诉我:")
    print("=" * 80)
    print("1. 后端接收到的实际payload是什么?")
    print("2. 后端发送到provider的请求是什么?")
    print("3. provider返回的具体错误信息是什么?")
    print("\n根据这些信息，我们才能确定400的真正原因。")

if __name__ == "__main__":
    main()