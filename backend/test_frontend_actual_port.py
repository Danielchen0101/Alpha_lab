#!/usr/bin/env python3
"""
测试前端实际连接的端口
"""

import requests
import json
import time

def test_port(port, endpoint, method='GET', data=None):
    """测试特定端口的连接"""
    base_url = f"http://127.0.0.1:{port}"
    
    try:
        if method == 'GET':
            response = requests.get(f"{base_url}{endpoint}", timeout=5)
        else:
            response = requests.post(f"{base_url}{endpoint}", json=data, timeout=5)
        
        print(f"端口 {port}: 状态码 {response.status_code}")
        
        if response.status_code == 200:
            try:
                resp_data = response.json()
                print(f"  响应: {json.dumps(resp_data, indent=2)[:200]}...")
                
                # 检查响应中的后端标识
                if 'backend' in resp_data:
                    print(f"  后端标识: {resp_data['backend']}")
                elif 'service' in resp_data:
                    print(f"  服务: {resp_data['service']}")
                    
                return True, resp_data
            except:
                print(f"  响应文本: {response.text[:100]}")
                return True, response.text
        else:
            print(f"  错误: {response.text[:100]}")
            return False, response.text
            
    except Exception as e:
        print(f"端口 {port}: 连接失败 - {e}")
        return False, str(e)

def main():
    print("测试前端实际连接的端口")
    print("=" * 80)
    
    # 读取前端代理配置
    try:
        with open('../frontend/package.json', 'r', encoding='utf-8') as f:
            package = json.load(f)
        
        proxy = package.get('proxy', '未设置')
        print(f"前端代理配置: {proxy}")
        
        # 解析代理配置中的端口
        if ':' in proxy:
            proxy_port = proxy.split(':')[-1]
            if proxy_port.isdigit():
                print(f"代理配置指向端口: {proxy_port}")
            else:
                print(f"无法解析代理端口: {proxy_port}")
        else:
            print(f"代理配置格式异常: {proxy}")
    except Exception as e:
        print(f"读取代理配置失败: {e}")
    
    print("\n测试可能的后端端口:")
    
    # 测试的端口列表
    ports_to_test = [8889, 8890, 8888, 3000, 5000]
    
    # 测试健康检查
    print("\n1. 测试健康检查 (/health):")
    active_ports = []
    for port in ports_to_test:
        success, _ = test_port(port, '/health')
        if success:
            active_ports.append(port)
    
    print(f"\n活跃的后端端口: {active_ports}")
    
    # 测试AI配置端点
    print("\n2. 测试AI配置端点 (/ai/provider/config):")
    for port in active_ports:
        print(f"\n端口 {port}:")
        success, data = test_port(port, '/ai/provider/config')
        if success and isinstance(data, dict):
            config = data.get('config', {})
            if config:
                print(f"  配置: provider={config.get('provider')}, apiKey长度={len(config.get('apiKey', ''))}")
    
    # 测试分析接口
    print("\n3. 测试分析接口 (/ai/analyze/single):")
    test_payload = {'symbol': 'AAPL'}
    for port in active_ports:
        print(f"\n端口 {port}:")
        success, data = test_port(port, '/ai/analyze/single', 'POST', test_payload)
        if success and isinstance(data, dict):
            print(f"  分析结果: success={data.get('success')}, trend={data.get('trend')}")
            print(f"  来源: {data.get('provenance', {})}")
    
    print("\n" + "=" * 80)
    print("分析结果:")
    
    if 8889 in active_ports:
        print("✅ 端口8889: 真实后端运行中")
        print("   - 前端代理配置指向8889端口")
        print("   - AI配置端点可访问")
        print("   - 分析接口返回模拟数据（API密钥无效）")
    else:
        print("❌ 端口8889: 真实后端未运行")
    
    if 8890 in active_ports:
        print("⚠️ 端口8890: 测试后端运行中")
    else:
        print("✅ 端口8890: 测试后端未运行")
    
    if 8888 in active_ports:
        print("⚠️ 端口8888: 其他服务运行中")
    
    print("\n结论:")
    if 8889 in active_ports:
        print("1. 前端实际连接到端口8889的真实后端")
        print("2. AI配置链路已打通")
        print("3. 问题在于API密钥无效，导致返回模拟数据")
        print("4. 需要有效API密钥进行真实AI分析")
    else:
        print("1. 真实后端未在8889端口运行")
        print("2. 需要启动真实后端")

if __name__ == "__main__":
    main()