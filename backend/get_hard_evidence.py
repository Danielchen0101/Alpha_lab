#!/usr/bin/env python3
"""
获取400错误的硬证据
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8889"

def test_400_scenario():
    """测试可能产生400的场景"""
    print("=" * 60)
    print("测试可能产生400错误的场景")
    print("=" * 60)
    
    # 场景1: provider/model不匹配（最可能产生400）
    print("\n场景1: provider/model不匹配")
    print("假设: provider=DeepSeek, model=test-chain-model")
    payload1 = {
        "provider": "DeepSeek",
        "model": "test-chain-model",  # 非法model
        "apiKey": "sk-12345678901234567890123456789012",  # 有效长度
        "baseUrl": "https://api.deepseek.com"
    }
    print(f"Payload: {json.dumps(payload1, indent=4)}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/provider/test",
            json=payload1,
            timeout=15
        )
        print(f"响应: {response.text}")
    except Exception as e:
        print(f"异常: {e}")
    
    # 场景2: 非法baseUrl
    print("\n场景2: 非法baseUrl")
    print("假设: baseUrl指向错误端点")
    payload2 = {
        "provider": "DeepSeek",
        "model": "deepseek-chat",
        "apiKey": "sk-12345678901234567890123456789012",
        "baseUrl": "https://api.deepseek.com/v1/wrong-endpoint"  # 错误端点
    }
    print(f"Payload: {json.dumps(payload2, indent=4)}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/provider/test",
            json=payload2,
            timeout=15
        )
        print(f"响应: {response.text}")
    except Exception as e:
        print(f"异常: {e}")
    
    # 场景3: 请求参数格式错误
    print("\n场景3: 请求参数格式错误")
    print("假设: messages格式错误")
    # 注意：这个测试需要修改后端代码来模拟
    
    return True

def analyze_backend_logic():
    """分析后端逻辑"""
    print("\n" + "=" * 60)
    print("后端逻辑分析")
    print("=" * 60)
    
    print("关键发现:")
    print("1. 后端不验证provider/model的有效性")
    print("2. 后端直接使用用户提供的provider/model/baseUrl")
    print("3. 后端硬编码请求路径为: {base_url}/chat/completions")
    print("4. 后端硬编码请求体格式为OpenAI兼容格式")
    
    print("\n问题:")
    print("1. 如果provider不是DeepSeek/OpenAI，/chat/completions可能不存在")
    print("2. 如果model不是有效模型名，API会返回400")
    print("3. 如果baseUrl不是有效API端点，会连接失败")
    
    print("\n截图中的400错误最可能原因:")
    print("用户输入: provider=test-chain-provider, model=test-chain-model")
    print("后端构建请求: POST https://api.test-chain.com/chat/completions")
    print("请求体: {'model': 'test-chain-model', 'messages': [...]}")
    print("结果: test-chain.com 可能:")
    print("  A) 返回400（不认识的model）")
    print("  B) 返回404（/chat/completions不存在）")
    print("  C) 连接失败（域名不存在）")

def check_what_we_need_from_backend_logs():
    """检查我们需要从后端日志获取什么"""
    print("\n" + "=" * 60)
    print("需要从后端日志获取的硬证据")
    print("=" * 60)
    
    print("1. 实际接收到的payload:")
    print("   - provider值是什么?")
    print("   - model值是什么?")
    print("   - apiKey长度和前缀?")
    print("   - baseUrl/baseURL值是什么?")
    
    print("\n2. 构建的请求:")
    print("   - 测试URL是什么?")
    print("   - 测试payload中的model是什么?")
    print("   - 请求头中的API key前缀?")
    
    print("\n3. Provider响应:")
    print("   - HTTP状态码?")
    print("   - 响应头?")
    print("   - 响应体内容（错误信息）?")
    
    print("\n4. 根据日志判断:")
    print("   - 是本地校验失败还是provider返回400?")
    print("   - provider返回的具体错误信息?")
    print("   - 错误原因是provider/model不匹配还是key无效?")

def create_test_to_reproduce_400():
    """创建重现400的测试"""
    print("\n" + "=" * 60)
    print("创建重现400错误的测试")
    print("=" * 60)
    
    print("要重现截图中的400错误，需要:")
    print("1. provider: test-chain-provider 或 DeepSeek")
    print("2. model: test-chain-model 或 非法模型名")
    print("3. apiKey: 有效长度但无效的key")
    print("4. baseUrl: https://api.deepseek.com 或 其他有效端点")
    
    print("\n测试用例:")
    test_cases = [
        {
            "name": "DeepSeek + 非法model",
            "payload": {
                "provider": "DeepSeek",
                "model": "test-chain-model",  # 非法
                "apiKey": "sk-12345678901234567890123456789012",
                "baseUrl": "https://api.deepseek.com"
            },
            "expected": "DeepSeek API返回400（非法model）"
        },
        {
            "name": "test-chain-provider + 任意model",
            "payload": {
                "provider": "test-chain-provider",
                "model": "any-model",
                "apiKey": "any-key",
                "baseUrl": "https://api.deepseek.com"  # 错误provider用DeepSeek端点
            },
            "expected": "可能400或连接失败"
        }
    ]
    
    for test_case in test_cases:
        print(f"\n测试: {test_case['name']}")
        print(f"Payload: {json.dumps(test_case['payload'], indent=4)}")
        print(f"预期: {test_case['expected']}")

def main():
    """主函数"""
    print("获取Test Connection 400错误的硬证据")
    print("=" * 60)
    
    # 测试400场景
    test_400_scenario()
    
    # 分析后端逻辑
    analyze_backend_logic()
    
    # 检查需要从日志获取的信息
    check_what_we_need_from_backend_logs()
    
    # 创建重现测试
    create_test_to_reproduce_400()
    
    print("\n" + "=" * 60)
    print("结论")
    print("=" * 60)
    print("基于代码分析，400错误最可能原因:")
    print("\n1. provider/model不匹配:")
    print("   - provider=DeepSeek, model=test-chain-model")
    print("   - DeepSeek API返回400（非法model）")
    
    print("\n2. 后端不验证provider/model:")
    print("   - 直接转发给配置的API")
    print("   - API返回400，后端包装后返回")
    
    print("\n3. 需要后端日志确认:")
    print("   - 实际接收的provider/model值")
    print("   - DeepSeek API返回的具体错误信息")

if __name__ == "__main__":
    main()