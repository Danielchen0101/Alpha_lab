#!/usr/bin/env python3
"""
检查Alpaca API配置
"""

import os
import sys

def check_alpaca_config():
    """检查Alpaca配置"""
    
    print("=" * 80)
    print("检查Alpaca API配置")
    print("=" * 80)
    
    # 尝试从环境变量读取
    alpaca_api_key = os.environ.get('ALPACA_API_KEY')
    alpaca_secret_key = os.environ.get('ALPACA_SECRET_KEY')
    alpaca_base_url = os.environ.get('ALPACA_BASE_URL', 'https://api.alpaca.markets')
    
    print(f"ALPACA_API_KEY: {'已配置' if alpaca_api_key else '未配置'}")
    if alpaca_api_key:
        print(f"  Key预览: {alpaca_api_key[:6]}...{alpaca_api_key[-4:] if len(alpaca_api_key) > 10 else ''}")
    
    print(f"ALPACA_SECRET_KEY: {'已配置' if alpaca_secret_key else '未配置'}")
    if alpaca_secret_key:
        print(f"  Secret预览: {alpaca_secret_key[:6]}...{alpaca_secret_key[-4:] if len(alpaca_secret_key) > 10 else ''}")
    
    print(f"ALPACA_BASE_URL: {alpaca_base_url}")
    
    # 检查后端代码中的配置
    print("\n检查后端代码中的Alpaca配置...")
    
    try:
        with open('start_quant_backend.py', 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 查找ALPACA配置
        import re
        alpaca_patterns = [
            r'ALPACA_API_KEY\s*=\s*["\']([^"\']+)["\']',
            r'ALPACA_SECRET_KEY\s*=\s*["\']([^"\']+)["\']',
            r'ALPACA_BASE_URL\s*=\s*["\']([^"\']+)["\']',
            r'alpaca\.config\s*=',
            r'from alpaca\.',
            r'import alpaca'
        ]
        
        for pattern in alpaca_patterns:
            matches = re.findall(pattern, content)
            if matches:
                print(f"找到匹配: {pattern}")
                for match in matches[:3]:  # 只显示前3个匹配
                    print(f"  匹配值: {match}")
            else:
                # 只显示关键配置的缺失
                if 'ALPACA_API_KEY' in pattern or 'ALPACA_SECRET_KEY' in pattern:
                    print(f"未找到: {pattern}")
                    
    except Exception as e:
        print(f"读取文件错误: {e}")
    
    # 测试Alpaca API连接
    print("\n测试Alpaca API连接...")
    
    if alpaca_api_key and alpaca_secret_key:
        try:
            import requests
            headers = {
                'APCA-API-KEY-ID': alpaca_api_key,
                'APCA-API-SECRET-KEY': alpaca_secret_key
            }
            
            # 测试获取账户信息
            url = f'{alpaca_base_url}/v2/account'
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                print(f"✅ Alpaca API连接成功 (状态码: {response.status_code})")
                account_data = response.json()
                print(f"  账户状态: {account_data.get('status', 'N/A')}")
                print(f"  账户ID: {account_data.get('id', 'N/A')}")
            else:
                print(f"❌ Alpaca API连接失败 (状态码: {response.status_code})")
                print(f"  响应: {response.text[:200]}")
                
        except ImportError:
            print("❌ 无法导入requests模块")
        except Exception as e:
            print(f"❌ Alpaca API测试异常: {e}")
    else:
        print("❌ Alpaca API密钥未配置，无法测试连接")
    
    # 结论
    print("\n" + "=" * 80)
    print("配置状态总结:")
    print("=" * 80)
    
    if alpaca_api_key and alpaca_secret_key:
        print("✅ Alpaca API密钥已配置")
        print("   如果backtest结果相同，可能是:")
        print("   1. API密钥无效或被限制")
        print("   2. Alpaca API返回了模拟/测试数据")
        print("   3. 后端代码逻辑有bug")
    else:
        print("❌ Alpaca API密钥未配置")
        print("   后端将使用模拟数据")
        print("   → 所有股票会有相同的backtest结果!")
        print("\n   解决方案:")
        print("   1. 设置环境变量 ALPACA_API_KEY 和 ALPACA_SECRET_KEY")
        print("   2. 或在后端代码中配置Alpaca密钥")

if __name__ == "__main__":
    check_alpaca_config()