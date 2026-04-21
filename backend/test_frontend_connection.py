#!/usr/bin/env python3
"""
测试前端实际连接的后端
"""

import requests
import json
import time

def test_connection(port):
    """测试特定端口的连接"""
    base_url = f"http://127.0.0.1:{port}"
    
    print(f"\n测试端口 {port}:")
    
    # 测试健康检查
    try:
        health_response = requests.get(f"{base_url}/health", timeout=5)
        print(f"  健康检查: 状态码 {health_response.status_code}")
        if health_response.status_code == 200:
            health_data = health_response.json()
            print(f"  服务: {health_data.get('service')}")
            return True
        else:
            print(f"  健康检查失败: {health_response.text[:100]}")
            return False
    except Exception as e:
        print(f"  连接失败: {e}")
        return False

def test_save_config(port):
    """测试保存配置到特定端口"""
    base_url = f"http://127.0.0.1:{port}"
    
    print(f"\n测试保存配置到端口 {port}:")
    
    config = {
        "provider": "DeepSeek",
        "model": "deepseek-chat",
        "apiKey": "sk-test-key-frontend-test-1234567890abcdef",
        "baseUrl": "https://api.deepseek.com"
    }
    
    try:
        response = requests.post(
            f"{base_url}/ai/provider/config",
            json=config,
            timeout=10
        )
        
        print(f"  状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  响应: success={data.get('success')}, message={data.get('message')}")
            return True
        else:
            print(f"  失败: {response.text[:100]}")
            return False
    except Exception as e:
        print(f"  异常: {e}")
        return False

def test_analyze_single(port):
    """测试分析接口到特定端口"""
    base_url = f"http://127.0.0.1:{port}"
    
    print(f"\n测试分析接口到端口 {port}:")
    
    payload = {"symbol": "AAPL"}
    
    try:
        response = requests.post(
            f"{base_url}/ai/analyze/single",
            json=payload,
            timeout=10
        )
        
        print(f"  状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"  响应: success={data.get('success')}, trend={data.get('trend')}")
            print(f"  provenance: {data.get('provenance')}")
            return True
        else:
            print(f"  失败: {response.text[:100]}")
            return False
    except Exception as e:
        print(f"  异常: {e}")
        return False

def check_frontend_proxy():
    """检查前端代理配置"""
    print("\n检查前端代理配置:")
    
    # 读取package.json
    import os
    package_json_path = "../frontend/package.json"
    
    if os.path.exists(package_json_path):
        with open(package_json_path, 'r', encoding='utf-8') as f:
            package_data = json.load(f)
        
        proxy = package_data.get('proxy', '未设置')
        print(f"  package.json proxy: {proxy}")
        
        if proxy == "http://127.0.0.1:8889":
            print("  ✅ 代理配置正确: 指向8889端口")
            return 8889
        elif proxy == "http://127.0.0.1:8890":
            print("  ⚠️ 代理配置指向测试端口8890")
            return 8890
        else:
            print(f"  ❌ 代理配置异常: {proxy}")
            return None
    else:
        print("  ❌ 找不到package.json")
        return None

def main():
    """主函数"""
    print("前端实际连接测试")
    print("=" * 80)
    
    # 检查代理配置
    expected_port = check_frontend_proxy()
    
    # 测试可能的所有端口
    ports_to_test = [8889, 8890, 3000, 3001, 5000]
    
    print("\n测试所有可能的后端端口:")
    
    active_ports = []
    for port in ports_to_test:
        if test_connection(port):
            active_ports.append(port)
    
    print(f"\n活跃的后端端口: {active_ports}")
    
    if not active_ports:
        print("❌ 没有发现活跃的后端服务")
        return
    
    # 测试保存配置到所有活跃端口
    print("\n测试保存配置到活跃端口:")
    for port in active_ports:
        test_save_config(port)
    
    # 测试分析接口到所有活跃端口
    print("\n测试分析接口到活跃端口:")
    for port in active_ports:
        test_analyze_single(port)
    
    print("\n" + "=" * 80)
    print("分析结果:")
    
    if 8889 in active_ports:
        print("✅ 真实后端在8889端口运行")
        if expected_port == 8889:
            print("✅ 前端代理配置正确指向8889端口")
            print("✅ 前端应该连接到真实后端")
        else:
            print("❌ 前端代理配置错误，未指向8889端口")
    else:
        print("❌ 真实后端未在8889端口运行")
    
    if 8890 in active_ports:
        print("⚠️ 测试后端在8890端口运行")
        if expected_port == 8890:
            print("⚠️ 前端代理配置指向测试后端8890端口")
        else:
            print("✅ 前端代理未指向测试后端")
    
    print("\n建议:")
    if 8889 in active_ports and expected_port == 8889:
        print("1. 前端正确连接到真实后端8889端口")
        print("2. 可以测试前端页面的实际请求")
    else:
        print("1. 需要确保真实后端在8889端口运行")
        print("2. 需要确保前端代理指向8889端口")

if __name__ == "__main__":
    main()