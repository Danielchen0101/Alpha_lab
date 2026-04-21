#!/usr/bin/env python3
"""
测试并查看详细日志
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8889"

def test_and_capture_logs():
    """测试并捕获日志"""
    print("=" * 60)
    print("测试Test Connection并查看后端日志")
    print("=" * 60)
    
    # 测试配置 - 模拟用户可能输入的内容
    test_configs = [
        {
            "name": "截图中的配置",
            "payload": {
                "provider": "DeepSeek",
                "apiKey": "sk-47f47112ba5744899172296fcc6ff2c7",
                "baseUrl": "https://api.deepseek.com",
                "model": "deepseek-chat"
            }
        },
        {
            "name": "无效短key",
            "payload": {
                "provider": "DeepSeek",
                "apiKey": "sk-test",
                "baseUrl": "https://api.deepseek.com",
                "model": "deepseek-chat"
            }
        },
        {
            "name": "有效长度但无效的key",
            "payload": {
                "provider": "DeepSeek",
                "apiKey": "sk-123456789012345678901234567890123",
                "baseUrl": "https://api.deepseek.com",
                "model": "deepseek-chat"
            }
        }
    ]
    
    for test_config in test_configs:
        print(f"\n{'='*40}")
        print(f"测试: {test_config['name']}")
        print(f"{'='*40}")
        
        print(f"发送的payload:")
        print(json.dumps(test_config['payload'], indent=4))
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/ai/provider/test",
                json=test_config['payload'],
                timeout=15
            )
            
            print(f"\nHTTP响应状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"响应JSON: {json.dumps(data, indent=4)}")
                
                # 分析响应
                print(f"\n分析:")
                print(f"  success: {data.get('success')}")
                print(f"  valid: {data.get('valid')}")
                print(f"  message: {data.get('message')}")
                
                if data.get('success'):
                    print("  [结果] Test Connection成功!")
                else:
                    message = data.get('message', '')
                    if '401' in message:
                        print("  [结果] API密钥无效或过期 (401)")
                    elif '400' in message:
                        print("  [结果] API请求参数错误 (400)")
                    elif 'API 密钥无效' in message:
                        print("  [结果] 后端验证拒绝: API密钥无效")
                    else:
                        print(f"  [结果] 其他错误: {message}")
            else:
                print(f"响应文本: {response.text[:500]}")
                
        except requests.exceptions.Timeout:
            print("请求超时")
        except Exception as e:
            print(f"异常: {e}")
    
    print(f"\n{'='*60}")
    print("重要发现:")
    print("=" * 60)
    print("1. 后端始终返回200状态码，错误在响应消息中")
    print("2. 'API 测试失败: 400' 来自第三方API的响应")
    print("3. 需要查看后端控制台日志了解详细错误")
    print("\n下一步:")
    print("1. 查看后端控制台输出")
    print("2. 检查实际发送到DeepSeek API的请求")
    print("3. 验证API密钥是否有效")

def check_backend_logs_instruction():
    """指导如何查看后端日志"""
    print(f"\n{'='*60}")
    print("如何查看后端日志:")
    print("=" * 60)
    print("1. 找到运行后端服务的终端/控制台")
    print("2. 应该能看到类似这样的输出:")
    print("   === AI Provider Test 请求 ===")
    print("   请求数据: {...}")
    print("   解析的apiKey: sk-47f4711... (长度: 35)")
    print("   provider: DeepSeek")
    print("   baseUrl: https://api.deepseek.com")
    print("   model: deepseek-chat")
    print("   测试URL: https://api.deepseek.com/chat/completions")
    print("   测试payload: {...}")
    print("   请求头Authorization: Bearer sk-47f4711...")
    print("   API测试失败，状态码: 400")
    print("   API响应头: {...}")
    print("   API响应文本: {...}")
    print("\n这些日志会显示:")
    print("- 前端发送的实际数据")
    print("- 后端构建的请求")
    print("- DeepSeek API的实际响应")

if __name__ == "__main__":
    test_and_capture_logs()
    check_backend_logs_instruction()