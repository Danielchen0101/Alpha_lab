#!/usr/bin/env python3
"""
获取精确的payload证据
"""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:8889"

def test_exact_screenshot_payload():
    """测试截图中的精确payload"""
    print("=" * 60)
    print("测试截图中的精确payload")
    print("=" * 60)
    
    # 根据截图，最可能的payload
    screenshot_payload = {
        "provider": "test-chain-provider",  # 截图显示
        "model": "test-chain-model",       # 截图显示
        "apiKey": "sk-47f47112ba5744899172296fcc6ff2c7",  # 截图中的key
        "baseUrl": "https://api.deepseek.com"  # 推测
    }
    
    print("前端发送的payload:")
    print(json.dumps(screenshot_payload, indent=4))
    print("\n发送到: POST /api/ai/provider/test")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/provider/test",
            json=screenshot_payload,
            timeout=15
        )
        
        print(f"\nHTTP状态码: {response.status_code}")
        print(f"响应体: {response.text}")
        
        # 等待后端日志输出
        print("\n等待后端日志输出...")
        time.sleep(2)
        
    except Exception as e:
        print(f"请求异常: {e}")

def test_variations():
    """测试payload变体"""
    print("\n" + "=" * 60)
    print("测试payload变体")
    print("=" * 60)
    
    test_cases = [
        {
            "name": "截图payload",
            "payload": {
                "provider": "test-chain-provider",
                "model": "test-chain-model",
                "apiKey": "sk-47f47112ba5744899172296fcc6ff2c7",
                "baseUrl": "https://api.deepseek.com"
            }
        },
        {
            "name": "DeepSeek有效配置",
            "payload": {
                "provider": "DeepSeek",
                "model": "deepseek-chat",
                "apiKey": "sk-47f47112ba5744899172296fcc6ff2c7",
                "baseUrl": "https://api.deepseek.com"
            }
        },
        {
            "name": "provider=DeepSeek, model=test-chain-model",
            "payload": {
                "provider": "DeepSeek",
                "model": "test-chain-model",
                "apiKey": "sk-47f47112ba5744899172296fcc6ff2c7",
                "baseUrl": "https://api.deepseek.com"
            }
        }
    ]
    
    for test_case in test_cases:
        print(f"\n{'='*40}")
        print(f"测试: {test_case['name']}")
        print(f"{'='*40}")
        print(f"Payload: {json.dumps(test_case['payload'], indent=4)}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/ai/provider/test",
                json=test_case['payload'],
                timeout=15
            )
            
            print(f"响应: {response.text}")
            time.sleep(1)
            
        except Exception as e:
            print(f"异常: {e}")

def check_backend_code_for_branches():
    """检查后端代码分支"""
    print("\n" + "=" * 60)
    print("后端代码分支检查")
    print("=" * 60)
    
    backend_file = "start_quant_backend_repaired.py"
    
    with open(backend_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 找到ai_provider_test函数
    start = content.find("def ai_provider_test():")
    if start == -1:
        print("未找到ai_provider_test函数")
        return
    
    # 找到函数结束
    end = content.find("def ", start + 1)
    if end == -1:
        end = len(content)
    
    func_content = content[start:end]
    lines = func_content.split('\n')
    
    print("可能返回400的分支:")
    
    for i, line in enumerate(lines):
        line_num = i + 1
        line_stripped = line.strip()
        
        # 检查返回400的分支
        if '400' in line_stripped or 'test_response.status_code' in line_stripped:
            print(f"\n第{line_num}行: {line_stripped}")
            
            # 显示上下文
            context_start = max(0, i-2)
            context_end = min(len(lines), i+3)
            
            for j in range(context_start, context_end):
                ctx_line_num = j + 1
                prefix = ">>> " if j == i else "    "
                print(f"{prefix}第{ctx_line_num:3d}行: {lines[j].rstrip()}")

def main():
    """主函数"""
    print("获取Test Connection 400错误的精确证据")
    print("=" * 60)
    
    # 测试截图payload
    test_exact_screenshot_payload()
    
    # 测试变体
    test_variations()
    
    # 检查后端分支
    check_backend_code_for_branches()
    
    print("\n" + "=" * 60)
    print("需要查看后端控制台获取的证据:")
    print("=" * 60)
    print("1. 后端接收到的request.json:")
    print("   === AI Provider Test 请求 ===")
    print("   请求数据: {...}")
    print("   解析的apiKey: ...")
    print("   provider: ...")
    print("   model: ...")
    print("   baseUrl: ...")
    print("   baseURL: ...")
    
    print("\n2. 后端发送到provider的请求:")
    print("   测试URL: ...")
    print("   测试payload: {...}")
    print("   请求头Authorization: Bearer ...")
    
    print("\n3. Provider的响应:")
    print("   API测试失败，状态码: ...")
    print("   API响应头: {...}")
    print("   API响应文本: {...}")

if __name__ == "__main__":
    main()