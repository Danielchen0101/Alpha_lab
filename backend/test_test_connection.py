#!/usr/bin/env python3
"""
测试Test Connection路由
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8889"

def test_test_connection_route():
    """测试Test Connection路由"""
    print("=== 测试Test Connection路由 ===")
    
    # 测试配置
    test_config = {
        "provider": "deepseek",
        "apiKey": "test-key-1234567890",  # 无效key，但应该返回验证失败而不是404
        "baseUrl": "https://api.deepseek.com",
        "model": "deepseek-chat"
    }
    
    # 测试带/api前缀
    print("\n1. 测试带/api前缀...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/provider/test",
            json=test_config,
            timeout=10
        )
        
        print(f"   状态码: {response.status_code}")
        print(f"   响应: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   JSON响应: {json.dumps(data, indent=2)}")
            return True
        elif response.status_code == 404:
            print("   [ERROR] 路由返回404 - 路由不存在或路径错误")
            return False
        else:
            print(f"   [INFO] 其他状态码: {response.status_code}")
            return True  # 至少路由存在
            
    except requests.exceptions.ConnectionError:
        print("   [ERROR] 连接错误 - 后端服务可能未运行")
        return False
    except Exception as e:
        print(f"   [ERROR] 异常: {e}")
        return False
    
    # 测试无前缀版本
    print("\n2. 测试无前缀版本...")
    try:
        response = requests.post(
            f"{BASE_URL}/ai/provider/test",
            json=test_config,
            timeout=5
        )
        
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 404:
            print("   [INFO] 无前缀路由返回404（正常，可能只有/api版本）")
        else:
            print(f"   [INFO] 无前缀路由状态码: {response.status_code}")
            
    except Exception as e:
        print(f"   [INFO] 无前缀路由异常: {e}")
    
    return True

def test_all_ai_routes():
    """测试所有AI相关路由"""
    print("\n=== 测试所有AI相关路由 ===")
    
    routes = [
        ("GET /api/ai/provider/config", f"{BASE_URL}/api/ai/provider/config", "GET"),
        ("POST /api/ai/provider/config", f"{BASE_URL}/api/ai/provider/config", "POST"),
        ("POST /api/ai/provider/test", f"{BASE_URL}/api/ai/provider/test", "POST"),
        ("POST /api/ai/analyze/single", f"{BASE_URL}/api/ai/analyze/single", "POST"),
    ]
    
    for name, url, method in routes:
        print(f"\n测试 {name}...")
        try:
            if method == "GET":
                response = requests.get(url, timeout=5)
            elif method == "POST":
                if "test" in url:
                    data = {"apiKey": "test", "provider": "test"}
                elif "analyze" in url:
                    data = {"symbol": "AAPL"}
                else:  # config
                    data = {"apiKey": "test", "provider": "test"}
                
                response = requests.post(url, json=data, timeout=10 if "analyze" in url else 5)
            
            print(f"   状态码: {response.status_code}")
            
            if response.status_code == 404:
                print(f"   [ERROR] {name} 返回404!")
            elif response.status_code == 200:
                print(f"   [SUCCESS] {name} 工作正常")
            else:
                print(f"   [INFO] {name} 状态码: {response.status_code}")
                
        except requests.exceptions.Timeout:
            if "analyze" in url:
                print("   [INFO] AI分析超时（正常）")
            else:
                print(f"   [ERROR] {name} 超时")
        except Exception as e:
            print(f"   [ERROR] {name} 异常: {e}")

def main():
    """主函数"""
    print("=" * 60)
    print("Test Connection 404问题诊断")
    print("=" * 60)
    
    # 测试Test Connection路由
    test_passed = test_test_connection_route()
    
    if not test_passed:
        print("\n[结论] Test Connection路由确实返回404")
        print("可能原因:")
        print("1. 后端路由定义有问题")
        print("2. 路由路径不匹配")
        print("3. 代理配置问题")
        print("4. 后端服务未正确重启")
    else:
        print("\n[结论] Test Connection路由工作正常")
        print("可能前端调用路径有问题")
    
    # 测试所有路由
    test_all_ai_routes()
    
    print("\n" + "=" * 60)
    print("诊断完成")
    print("=" * 60)

if __name__ == "__main__":
    main()