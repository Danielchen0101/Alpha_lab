#!/usr/bin/env python3
"""
捕获真实的请求和响应payloads
"""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:8889"

def capture_frontend_payload():
    """捕获前端可能发送的payload"""
    print("=" * 60)
    print("前端可能发送的payload（根据代码分析）")
    print("=" * 60)
    
    # 情况1: 用户留空表单，使用默认值
    print("\n情况1: 用户留空表单（使用默认值）")
    payload1 = {
        "provider": "DeepSeek",  # 默认值
        "model": "deepseek-chat",  # 默认值
        "apiKey": "",  # 空字符串
        "baseUrl": "https://api.deepseek.com"  # 默认值
    }
    print(f"Payload: {json.dumps(payload1, indent=4)}")
    
    # 情况2: 用户输入测试值（如截图）
    print("\n情况2: 用户输入测试值（截图显示）")
    payload2 = {
        "provider": "test-chain-provider",  # 截图显示
        "model": "test-chain-model",  # 截图显示
        "apiKey": "test-chain-key-1234567890",  # 推测
        "baseUrl": "https://api.test-chain.com"  # 推测
    }
    print(f"Payload: {json.dumps(payload2, indent=4)}")
    
    # 情况3: 用户输入有效DeepSeek配置
    print("\n情况3: 用户输入有效DeepSeek配置")
    payload3 = {
        "provider": "DeepSeek",
        "model": "deepseek-chat",
        "apiKey": "sk-47f47112ba5744899172296fcc6ff2c7",  # 截图中的key
        "baseUrl": "https://api.deepseek.com"
    }
    print(f"Payload: {json.dumps(payload3, indent=4)}")
    
    return [payload1, payload2, payload3]

def test_and_capture_backend_logs(payloads):
    """测试并捕获后端日志"""
    print("\n" + "=" * 60)
    print("发送请求并查看后端日志")
    print("=" * 60)
    print("注意：需要查看后端控制台输出以获取详细日志")
    print("\n发送以下请求到: POST /api/ai/provider/test")
    
    for i, payload in enumerate(payloads, 1):
        print(f"\n{'='*40}")
        print(f"测试 {i}:")
        print(f"{'='*40}")
        print(f"发送的payload: {json.dumps(payload, indent=4)}")
        
        try:
            response = requests.post(
                f"{BASE_URL}/api/ai/provider/test",
                json=payload,
                timeout=15
            )
            
            print(f"HTTP状态码: {response.status_code}")
            print(f"响应体: {response.text[:500]}")
            
            # 等待后端日志输出
            time.sleep(1)
            
        except Exception as e:
            print(f"请求异常: {e}")

def analyze_backend_code_for_branches():
    """分析后端代码中的分支"""
    print("\n" + "=" * 60)
    print("后端代码分支分析")
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
    
    branch_count = 0
    for i, line in enumerate(lines):
        line_num = i + 1
        line_stripped = line.strip()
        
        # 检查返回错误的分支
        if 'return jsonify' in line_stripped and ('False' in line_stripped or '400' in line_stripped or '401' in line_stripped):
            branch_count += 1
            print(f"\n分支 {branch_count} (第{line_num}行):")
            
            # 显示上下文
            context_start = max(0, i-3)
            context_end = min(len(lines), i+4)
            
            for j in range(context_start, context_end):
                ctx_line_num = j + 1
                prefix = ">>> " if j == i else "    "
                print(f"{prefix}第{ctx_line_num:3d}行: {lines[j].rstrip()}")

def check_provider_model_validation():
    """检查provider/model验证"""
    print("\n" + "=" * 60)
    print("Provider/Model验证检查")
    print("=" * 60)
    
    backend_file = "start_quant_backend_repaired.py"
    
    with open(backend_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查是否有provider/model验证
    if 'provider' in content and 'model' in content:
        print("代码中包含provider和model字段处理")
        
        # 查找provider相关代码
        provider_lines = []
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if 'provider' in line.lower() and 'data.get' in line:
                provider_lines.append((i+1, line.strip()))
        
        if provider_lines:
            print("\nProvider处理代码:")
            for line_num, line in provider_lines[:5]:  # 只显示前5个
                print(f"  第{line_num}行: {line}")
        
        # 查找model相关代码
        model_lines = []
        for i, line in enumerate(lines):
            if 'model' in line.lower() and 'data.get' in line:
                model_lines.append((i+1, line.strip()))
        
        if model_lines:
            print("\nModel处理代码:")
            for line_num, line in model_lines[:5]:  # 只显示前5个
                print(f"  第{line_num}行: {line}")
    else:
        print("未找到provider/model验证代码")

def main():
    """主函数"""
    print("Test Connection 400错误硬证据收集")
    print("=" * 60)
    
    # 1. 捕获前端可能发送的payload
    payloads = capture_frontend_payload()
    
    # 2. 发送请求并提示查看后端日志
    test_and_capture_backend_logs(payloads)
    
    # 3. 分析后端代码分支
    analyze_backend_code_for_branches()
    
    # 4. 检查provider/model验证
    check_provider_model_validation()
    
    print("\n" + "=" * 60)
    print("下一步操作指南")
    print("=" * 60)
    print("1. 查看后端控制台输出，应该能看到:")
    print("   - 接收到的请求数据")
    print("   - 解析的字段值")
    print("   - 发送到provider的请求")
    print("   - provider的响应")
    print("\n2. 根据后端日志回答:")
    print("   - 实际接收到的payload是什么?")
    print("   - provider/model是什么值?")
    print("   - 发送到哪个URL?")
    print("   - provider返回什么错误?")

if __name__ == "__main__":
    main()