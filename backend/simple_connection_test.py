#!/usr/bin/env python3
"""
简单连接测试 - 无emoji
"""

import requests
import json
import os

def test_port(port):
    """测试端口"""
    base_url = f"http://127.0.0.1:{port}"
    
    print(f"\n测试端口 {port}:")
    
    try:
        # 测试健康检查
        health = requests.get(f"{base_url}/health", timeout=5)
        print(f"  健康检查: 状态码 {health.status_code}")
        
        if health.status_code == 200:
            data = health.json()
            print(f"  服务: {data.get('service')}")
            
            # 测试保存配置
            config = {
                "provider": "DeepSeek",
                "model": "deepseek-chat",
                "apiKey": "sk-test-key-frontend-test",
                "baseUrl": "https://api.deepseek.com"
            }
            
            save_resp = requests.post(f"{base_url}/ai/provider/config", json=config, timeout=10)
            print(f"  保存配置: 状态码 {save_resp.status_code}")
            
            # 测试分析
            analyze_resp = requests.post(f"{base_url}/ai/analyze/single", json={"symbol": "AAPL"}, timeout=10)
            print(f"  分析接口: 状态码 {analyze_resp.status_code}")
            
            if analyze_resp.status_code == 200:
                analyze_data = analyze_resp.json()
                print(f"  分析结果: success={analyze_data.get('success')}")
                print(f"  使用的provider: {analyze_data.get('provenance', {}).get('aiAnalysis')}")
            
            return True
        else:
            print(f"  健康检查失败")
            return False
            
    except Exception as e:
        print(f"  连接失败: {e}")
        return False

def main():
    print("前端实际连接测试")
    print("=" * 80)
    
    # 检查代理配置
    package_path = "../frontend/package.json"
    if os.path.exists(package_path):
        with open(package_path, 'r', encoding='utf-8') as f:
            package = json.load(f)
        
        proxy = package.get('proxy', '未设置')
        print(f"前端代理配置: {proxy}")
        
        if proxy == "http://127.0.0.1:8889":
            print("代理指向8889端口 - 正确")
        elif proxy == "http://127.0.0.1:8890":
            print("代理指向8890端口 - 测试端口")
        else:
            print(f"代理配置异常")
    
    print("\n测试后端端口:")
    
    # 测试8889端口（真实后端）
    port_8889_active = test_port(8889)
    
    # 测试8890端口（测试后端）
    port_8890_active = test_port(8890)
    
    print("\n" + "=" * 80)
    print("结论:")
    
    if port_8889_active:
        print("1. 真实后端在8889端口运行")
        print("2. 前端代理配置指向8889端口")
        print("3. 前端应该连接到真实后端")
        
        # 验证配置使用
        print("\n验证配置使用:")
        try:
            resp = requests.post(
                "http://127.0.0.1:8889/ai/analyze/single",
                json={"symbol": "AAPL"},
                timeout=10
            )
            if resp.status_code == 200:
                data = resp.json()
                print(f"  分析请求成功")
                print(f"  使用的provider: {data.get('provenance', {}).get('aiAnalysis')}")
                print(f"  结果类型: {'模拟数据' if data.get('trend') == 'Bullish' else '真实数据'}")
        except Exception as e:
            print(f"  验证失败: {e}")
    else:
        print("1. 真实后端未在8889端口运行")
        
    if port_8890_active:
        print("2. 测试后端在8890端口运行")
    else:
        print("2. 测试后端未运行")

if __name__ == "__main__":
    main()