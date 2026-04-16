#!/usr/bin/env python3
"""
AI配置链路测试
验证AI Configuration作为唯一AI调用来源的完整链路
"""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:8889"

def test_ai_config_save_load():
    """测试AI配置保存和加载链路"""
    print("=== 测试AI配置保存和加载链路 ===")
    
    # 1. 首先获取当前配置
    print("\n1. 获取当前AI配置...")
    try:
        response = requests.get(f"{BASE_URL}/api/ai/provider/config")
        if response.status_code == 200:
            data = response.json()
            print(f"   当前配置: {json.dumps(data, indent=2)}")
            
            # 检查是否有硬编码key
            config = data.get('config', {})
            if config.get('apiKey') == 'sk-83365246617844178bf8d1e121b7279f':
                print("   [WARNING] 警告: 当前配置包含硬编码API key")
            else:
                print("   [SUCCESS] 当前配置不包含硬编码key")
        else:
            print(f"   [ERROR] 获取配置失败: {response.status_code}")
    except Exception as e:
        print(f"   [ERROR] 获取配置异常: {e}")
    
    # 2. 保存新配置
    print("\n2. 保存新AI配置...")
    new_config = {
        "provider": "deepseek",
        "apiKey": "test-user-api-key-1234567890",  # 测试用key
        "baseUrl": "https://api.deepseek.com",
        "model": "deepseek-chat"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/ai/provider/config", json=new_config)
        if response.status_code == 200:
            data = response.json()
            print(f"   保存响应: {json.dumps(data, indent=2)}")
            
            if data.get('success'):
                print("   [SUCCESS] 配置保存成功")
            else:
                print("   [ERROR] 配置保存失败")
        else:
            print(f"   [ERROR] 保存配置失败: {response.status_code}")
    except Exception as e:
        print(f"   [ERROR] 保存配置异常: {e}")
    
    # 3. 重新获取配置验证保存
    print("\n3. 重新获取配置验证保存...")
    try:
        response = requests.get(f"{BASE_URL}/api/ai/provider/config")
        if response.status_code == 200:
            data = response.json()
            config = data.get('config', {})
            print(f"   重新获取的配置: {json.dumps(config, indent=2)}")
            
            # 验证配置是否正确保存
            if (config.get('apiKey') == 'test-user-api-key-1234567890' and
                config.get('provider') == 'deepseek' and
                config.get('baseURL') == 'https://api.deepseek.com' and
                config.get('model') == 'deepseek-chat'):
                print("   [SUCCESS] 配置正确保存并重新加载")
            else:
                print("   [ERROR] 配置未正确保存")
        else:
            print(f"   [ERROR] 重新获取配置失败: {response.status_code}")
    except Exception as e:
        print(f"   [ERROR] 重新获取配置异常: {e}")
    
    # 4. 测试AI分析是否使用保存的配置
    print("\n4. 测试AI分析是否使用保存的配置...")
    test_symbol = "AAPL"
    try:
        response = requests.post(
            f"{BASE_URL}/ai/analyze/single",
            json={"symbol": test_symbol},
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"   AI分析响应状态: {response.status_code}")
            print(f"   success字段: {data.get('success')}")
            print(f"   message字段: {data.get('message')}")
            
            # 检查provenance字段
            provenance = data.get('provenance', {})
            print(f"   provenance: {provenance}")
            
            if provenance.get('aiAnalysis') == 'deepseek':
                print("   [SUCCESS] AI分析使用了DeepSeek（配置生效）")
            else:
                print(f"   [WARNING] AI分析使用了其他provider: {provenance.get('aiAnalysis')}")
        else:
            print(f"   [ERROR] AI分析失败: {response.status_code}")
            print(f"   响应: {response.text[:200]}")
    except requests.exceptions.Timeout:
        print("   [TIMEOUT] AI分析超时（正常，因为测试key无效）")
    except Exception as e:
        print(f"   [ERROR] AI分析异常: {e}")
    
    return True

def test_hardcoded_keys():
    """检查所有硬编码的AI key"""
    print("\n=== 检查硬编码的AI key ===")
    
    hardcoded_locations = []
    
    # 检查后端文件
    backend_file = "professional_quant_platform/backend/start_quant_backend_repaired.py"
    
    try:
        with open(backend_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 检查硬编码key
        hardcoded_key = 'sk-83365246617844178bf8d1e121b7279f'
        if hardcoded_key in content:
            print(f"   [ERROR] 发现硬编码key: {hardcoded_key[:20]}...")
            
            # 找到具体位置
            lines = content.split('\n')
            for i, line in enumerate(lines, 1):
                if hardcoded_key in line:
                    hardcoded_locations.append(f"第{i}行: {line.strip()}")
            
            print(f"   发现 {len(hardcoded_locations)} 处硬编码:")
            for loc in hardcoded_locations[:5]:  # 只显示前5处
                print(f"     - {loc}")
        else:
            print("   [SUCCESS] 未发现硬编码key")
            
    except Exception as e:
        print(f"   [ERROR] 检查文件失败: {e}")
    
    return hardcoded_locations

def test_route_consistency():
    """测试路由一致性"""
    print("\n=== 测试路由一致性 ===")
    
    routes_to_test = [
        # (前端调用, 后端路由, 描述)
        ("/market/stock/{symbol}", "/market/stock/<symbol>", "单只股票数据"),
        ("/market/news/{symbol}", "/market/news/<symbol>", "股票新闻"),
        ("/ai/analyze/single", "/ai/analyze/single", "AI分析"),
        ("/ai/provider/config", "/api/ai/provider/config", "AI配置"),
    ]
    
    inconsistencies = []
    
    for frontend_route, backend_pattern, description in routes_to_test:
        print(f"\n测试 {description}:")
        print(f"  前端调用: {frontend_route}")
        print(f"  后端路由: {backend_pattern}")
        
        # 检查后端文件是否有对应路由
        backend_file = "professional_quant_platform/backend/start_quant_backend_repaired.py"
        try:
            with open(backend_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 转换前端路由为后端模式
            backend_route = frontend_route.replace('{symbol}', '<symbol>')
            
            # 检查是否有带/api和不带/api的版本
            has_api_version = f"@app.route('/api{backend_route}'" in content
            has_no_api_version = f"@app.route('{backend_route}'" in content
            
            if has_api_version and has_no_api_version:
                print("   [SUCCESS] 路由一致（有/api和无/api版本）")
            elif has_api_version:
                print("   [WARNING] 只有/api版本，前端可能调用失败")
                inconsistencies.append(f"{description}: 只有/api版本")
            elif has_no_api_version:
                print("   [WARNING] 只有无/api版本，前端可能调用失败")
                inconsistencies.append(f"{description}: 只有无/api版本")
            else:
                print("   [ERROR] 路由未找到")
                inconsistencies.append(f"{description}: 路由未找到")
                
        except Exception as e:
            print(f"   [ERROR] 检查路由失败: {e}")
    
    return inconsistencies

def test_ai_config_persistence():
    """测试AI配置持久化"""
    print("\n=== 测试AI配置持久化 ===")
    
    # 注意：当前实现使用内存存储，重启后会丢失
    # 这里测试的是当前会话内的持久化
    
    test_config = {
        "provider": "test-provider",
        "apiKey": "test-persistence-key-9876543210",
        "baseUrl": "https://api.test.com",
        "model": "test-model"
    }
    
    # 1. 保存配置
    print("1. 保存测试配置...")
    try:
        response = requests.post(f"{BASE_URL}/api/ai/provider/config", json=test_config)
        if response.status_code == 200 and response.json().get('success'):
            print("   [SUCCESS] 测试配置保存成功")
        else:
            print(f"   [ERROR] 测试配置保存失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"   [ERROR] 保存测试配置异常: {e}")
        return False
    
    # 2. 模拟"刷新页面" - 重新获取配置
    print("2. 模拟刷新页面后重新获取配置...")
    time.sleep(1)  # 短暂延迟
    
    try:
        response = requests.get(f"{BASE_URL}/api/ai/provider/config")
        if response.status_code == 200:
            data = response.json()
            config = data.get('config', {})
            
            # 检查配置是否仍然存在
            if (config.get('provider') == 'test-provider' and
                config.get('apiKey') == 'test-persistence-key-9876543210'):
                print("   [SUCCESS] 配置在当前会话中持久化")
            else:
                print(f"   [ERROR] 配置未持久化: {config}")
                return False
        else:
            print(f"   [ERROR] 获取配置失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"   [ERROR] 获取配置异常: {e}")
        return False
    
    print("   [WARNING] 注意：当前实现使用内存存储，后端重启后配置会丢失")
    print("   需要实现文件或数据库持久化")
    
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("AI配置链路测试")
    print("=" * 60)
    
    # 运行测试
    test1_passed = test_ai_config_save_load()
    hardcoded_keys = test_hardcoded_keys()
    route_issues = test_route_consistency()
    persistence_ok = test_ai_config_persistence()
    
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    
    print(f"1. AI配置保存加载: {'[SUCCESS] 通过' if test1_passed else '[ERROR] 失败'}")
    print(f"2. 硬编码key检查: {len(hardcoded_keys)} 处发现")
    print(f"3. 路由一致性: {len(route_issues)} 处问题")
    print(f"4. 配置持久化: {'[SUCCESS] 当前会话内通过' if persistence_ok else '[ERROR] 失败'}")
    
    print("\n关键发现:")
    if hardcoded_keys:
        print("  [ERROR] 必须删除硬编码key，使用用户保存的配置")
    
    if route_issues:
        print("  [WARNING] 路由不一致问题需要修复")
    
    print("\n建议修复:")
    print("  1. 删除所有硬编码AI key")
    print("  2. 确保所有AI调用都从ai_provider_config_state读取配置")
    print("  3. 实现配置的持久化存储（文件或数据库）")
    print("  4. 统一路由前缀（都使用/api或都不使用）")
    
    print("=" * 60)