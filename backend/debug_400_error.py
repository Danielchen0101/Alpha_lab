#!/usr/bin/env python3
"""
调试Test Connection 400错误
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8889"

def test_frontend_payload():
    """模拟前端发送的payload"""
    print("=== 模拟前端发送的payload ===")
    
    # 模拟前端表单数据（用户可能输入的值）
    frontend_payloads = [
        {
            "name": "Case 1: 用户填写测试配置",
            "payload": {
                "provider": "test-chain-provider",
                "apiKey": "test-chain-key-1234567890",
                "baseUrl": "https://api.test-chain.com",
                "model": "test-chain-model"
            }
        },
        {
            "name": "Case 2: 用户填写DeepSeek配置",
            "payload": {
                "provider": "DeepSeek",
                "apiKey": "sk-test-deepseek-key-1234567890",
                "baseUrl": "https://api.deepseek.com",
                "model": "deepseek-chat"
            }
        },
        {
            "name": "Case 3: 用户留空部分字段",
            "payload": {
                "provider": "",
                "apiKey": "",
                "baseUrl": "",
                "model": ""
            }
        },
        {
            "name": "Case 4: 字段名测试（baseUrl vs baseURL）",
            "payload": {
                "provider": "DeepSeek",
                "apiKey": "sk-test",
                "baseURL": "https://api.deepseek.com",  # 大写URL
                "model": "deepseek-chat"
            }
        }
    ]
    
    for test_case in frontend_payloads:
        print(f"\n{test_case['name']}:")
        print(f"   Payload: {json.dumps(test_case['payload'], indent=4)}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/ai/provider/test",
                json=test_case['payload'],
                timeout=10
            )
            
            print(f"   状态码: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   响应: {json.dumps(data, indent=4)}")
            else:
                print(f"   响应文本: {response.text[:200]}")
                
        except Exception as e:
            print(f"   异常: {e}")

def analyze_backend_code():
    """分析后端代码逻辑"""
    print("\n=== 分析后端代码逻辑 ===")
    
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
    
    print("后端ai_provider_test函数关键逻辑:")
    
    # 提取关键校验逻辑
    lines = func_content.split('\n')
    for i, line in enumerate(lines):
        if 'api_key.startswith' in line or 'not api_key' in line:
            print(f"  第{i+1}行: {line.strip()}")
        if 'return jsonify' in line and '400' in line:
            print(f"  第{i+1}行: {line.strip()}")
        if 'test_response.status_code' in line:
            print(f"  第{i+1}行: {line.strip()}")
    
    # 分析可能的400返回点
    print("\n可能返回400的地方:")
    print("1. 如果apiKey为空或无效: if not api_key or api_key.startswith('sk-') and len(api_key) < 30:")
    print("2. 调用DeepSeek API失败: test_response.status_code != 200")
    print("3. 异常捕获: except Exception as e:")

def test_actual_validation():
    """测试实际验证逻辑"""
    print("\n=== 测试实际验证逻辑 ===")
    
    test_cases = [
        {
            "name": "短sk- key（应该被拒绝）",
            "payload": {"apiKey": "sk-123", "provider": "DeepSeek"},
            "expected": "API 密钥无效或未提供"
        },
        {
            "name": "空apiKey",
            "payload": {"apiKey": "", "provider": "DeepSeek"},
            "expected": "API 密钥无效或未提供"
        },
        {
            "name": "有效长度但无效的key",
            "payload": {"apiKey": "sk-123456789012345678901234567890", "provider": "DeepSeek", "baseUrl": "https://api.deepseek.com", "model": "deepseek-chat"},
            "expected": "API 测试失败"  # 会尝试调用API
        },
        {
            "name": "缺少provider",
            "payload": {"apiKey": "sk-test", "baseUrl": "https://api.deepseek.com"},
            "expected": "可能通过校验"
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
                
                if test_case['expected'] in data.get('message', ''):
                    print(f"  [匹配] 响应包含预期消息: {test_case['expected']}")
                else:
                    print(f"  [不匹配] 响应消息: {data.get('message', '')}")
            else:
                print(f"  响应文本: {response.text[:200]}")
                
        except Exception as e:
            print(f"  异常: {e}")

def check_response_format():
    """检查响应格式"""
    print("\n=== 检查响应格式 ===")
    
    # 测试一个会返回400/错误的情况
    payload = {
        "provider": "test-provider",
        "apiKey": "sk-test",  # 短key，应该被拒绝
        "baseUrl": "https://api.test.com",
        "model": "test-model"
    }
    
    print(f"测试payload: {json.dumps(payload, indent=4)}")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/provider/test",
            json=payload,
            timeout=5
        )
        
        print(f"状态码: {response.status_code}")
        print(f"响应头: {dict(response.headers)}")
        print(f"完整响应: {response.text}")
        
        # 尝试解析JSON
        try:
            data = response.json()
            print(f"JSON解析成功: {json.dumps(data, indent=4)}")
            
            # 检查响应结构
            required_keys = ['success', 'message', 'valid']
            missing_keys = [k for k in required_keys if k not in data]
            
            if missing_keys:
                print(f"响应缺少键: {missing_keys}")
            else:
                print("响应结构完整")
                
        except json.JSONDecodeError:
            print("响应不是有效的JSON")
            
    except Exception as e:
        print(f"请求异常: {e}")

def main():
    """主函数"""
    print("=" * 60)
    print("Test Connection 400错误诊断")
    print("=" * 60)
    
    # 模拟前端payload
    test_frontend_payload()
    
    # 分析后端代码
    analyze_backend_code()
    
    # 测试实际验证逻辑
    test_actual_validation()
    
    # 检查响应格式
    check_response_format()
    
    print("\n" + "=" * 60)
    print("诊断总结")
    print("=" * 60)
    print("根据后端代码分析，400错误可能来自:")
    print("1. API密钥校验失败: apiKey为空或长度<30的sk-开头key")
    print("2. DeepSeek API调用失败: 返回非200状态码")
    print("3. 网络异常: 连接超时或DNS错误")
    print("\n截图显示'API 测试失败: 400'，这来自:")
    print("   message: f'API 测试失败: {test_response.status_code}'")
    print("说明后端成功调用了配置的API，但API返回了400")

if __name__ == "__main__":
    main()