#!/usr/bin/env python3
"""
测试后端 Alpaca 代理接口
"""

import requests
import json

# 后端 API 地址
BASE_URL = "http://localhost:8889/api"

def test_broker_proxy():
    """测试 broker 代理接口"""
    print("=== 测试后端 Alpaca 代理接口 ===\n")
    
    # 测试 1: 获取账户信息
    print("1. 测试 /api/broker/account")
    try:
        response = requests.get(f"{BASE_URL}/broker/account", timeout=10)
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ 成功获取账户信息")
            print(f"     账户号: {data.get('account_number', 'N/A')}")
            print(f"     状态: {data.get('status', 'N/A')}")
            print(f"     现金: ${data.get('cash', 0):.2f}")
            print(f"     权益: ${data.get('equity', 0):.2f}")
        else:
            error_data = response.json() if response.content else {}
            print(f"   ❌ 失败: {response.status_code}")
            print(f"     错误: {error_data.get('error', 'Unknown error')}")
            print(f"     消息: {error_data.get('message', 'No message')}")
    except requests.exceptions.ConnectionError:
        print("   ❌ 连接失败: 后端服务未启动")
    except requests.exceptions.Timeout:
        print("   ❌ 请求超时")
    except Exception as e:
        print(f"   ❌ 未知错误: {e}")
    
    print()
    
    # 测试 2: 获取持仓信息
    print("2. 测试 /api/broker/positions")
    try:
        response = requests.get(f"{BASE_URL}/broker/positions", timeout=10)
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print(f"   ✅ 成功获取持仓信息")
                print(f"     持仓数量: {len(data)}")
                if data:
                    print(f"     示例持仓:")
                    for i, position in enumerate(data[:2]):  # 只显示前2个
                        print(f"       {i+1}. {position.get('symbol', 'N/A')}: {position.get('qty', 0)} 股")
                else:
                    print(f"     无持仓")
            else:
                print(f"   ⚠️ 返回格式不是数组: {type(data)}")
        else:
            error_data = response.json() if response.content else {}
            print(f"   ❌ 失败: {response.status_code}")
            print(f"     错误: {error_data.get('error', 'Unknown error')}")
            print(f"     消息: {error_data.get('message', 'No message')}")
    except requests.exceptions.ConnectionError:
        print("   ❌ 连接失败: 后端服务未启动")
    except requests.exceptions.Timeout:
        print("   ❌ 请求超时")
    except Exception as e:
        print(f"   ❌ 未知错误: {e}")
    
    print()
    
    # 测试 3: 获取订单信息
    print("3. 测试 /api/broker/orders")
    try:
        response = requests.get(f"{BASE_URL}/broker/orders", timeout=10)
        print(f"   状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print(f"   ✅ 成功获取订单信息")
                print(f"     订单数量: {len(data)}")
                if data:
                    print(f"     示例订单:")
                    for i, order in enumerate(data[:2]):  # 只显示前2个
                        print(f"       {i+1}. {order.get('symbol', 'N/A')}: {order.get('status', 'N/A')}")
                else:
                    print(f"     无订单")
            else:
                print(f"   ⚠️ 返回格式不是数组: {type(data)}")
        else:
            error_data = response.json() if response.content else {}
            print(f"   ❌ 失败: {response.status_code}")
            print(f"     错误: {error_data.get('error', 'Unknown error')}")
            print(f"     消息: {error_data.get('message', 'No message')}")
    except requests.exceptions.ConnectionError:
        print("   ❌ 连接失败: 后端服务未启动")
    except requests.exceptions.Timeout:
        print("   ❌ 请求超时")
    except Exception as e:
        print(f"   ❌ 未知错误: {e}")
    
    print()
    
    # 总结
    print("=== 测试总结 ===")
    print("1. 后端代理接口已实现:")
    print("   - /api/broker/account")
    print("   - /api/broker/positions")
    print("   - /api/broker/orders")
    print()
    print("2. 前端已修改:")
    print("   - 不再直接调用 Alpaca API")
    print("   - 改为调用后端代理接口")
    print("   - 移除了前端环境变量中的 Alpaca 密钥")
    print()
    print("3. 安全改进:")
    print("   - Alpaca API 密钥只存在于后端")
    print("   - 前端代码不再暴露密钥")
    print("   - 避免了 CORS 问题")
    print()
    print("4. 注意事项:")
    print("   - 需要启动后端服务 (端口 8889)")
    print("   - 需要配置正确的 Alpaca 密钥到后端")
    print("   - 如果 Alpaca 密钥无效，代理接口会返回错误")

if __name__ == "__main__":
    test_broker_proxy()