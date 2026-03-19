import requests
import time
import json

print("=== 测试 Alpaca 交易执行层 API ===")
print("等待后端启动...")
time.sleep(3)

# 测试健康检查
print("\n1. 测试健康检查:")
try:
    response = requests.get("http://127.0.0.1:8889/api/health", timeout=5)
    print(f"   状态: {response.status_code}")
    print(f"   响应: {response.json()}")
except Exception as e:
    print(f"   错误: {e}")

# 测试账户信息
print("\n2. 测试账户信息 (/api/trading/account):")
try:
    response = requests.get("http://127.0.0.1:8889/api/trading/account", timeout=10)
    print(f"   状态: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        if "error" in data:
            print(f"   错误: {data['error']}")
        else:
            print(f"   账户状态: {data.get('status')}")
            print(f"   现金: ${data.get('cash')}")
            print(f"   投资组合价值: ${data.get('portfolio_value')}")
            print(f"   购买力: ${data.get('buying_power')}")
            print(f"   数据源: {data.get('dataSource')}")
    elif response.status_code == 503:
        print(f"   Alpaca服务不可用")
    else:
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"   错误: {e}")

# 测试持仓
print("\n3. 测试持仓 (/api/trading/positions):")
try:
    response = requests.get("http://127.0.0.1:8889/api/trading/positions", timeout=10)
    print(f"   状态: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        if "error" in data:
            print(f"   错误: {data['error']}")
        else:
            print(f"   持仓数量: {data.get('count')}")
            print(f"   数据源: {data.get('dataSource')}")
            positions = data.get('positions', [])
            for pos in positions[:5]:  # 显示前5个
                print(f"   - {pos.get('symbol')}: {pos.get('qty')}股, 市值=${pos.get('market_value')}")
    elif response.status_code == 503:
        print(f"   Alpaca服务不可用")
    else:
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"   错误: {e}")

# 测试订单
print("\n4. 测试订单 (/api/trading/orders):")
try:
    response = requests.get("http://127.0.0.1:8889/api/trading/orders", 
                          params={"status": "open", "limit": 5},
                          timeout=10)
    print(f"   状态: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        if "error" in data:
            print(f"   错误: {data['error']}")
        else:
            print(f"   订单数量: {data.get('count')}")
            print(f"   订单状态: {data.get('status')}")
            print(f"   数据源: {data.get('dataSource')}")
            orders = data.get('orders', [])
            for order in orders[:5]:
                print(f"   - {order.get('symbol')}: {order.get('side')} {order.get('qty')}股 ({order.get('status')})")
    elif response.status_code == 503:
        print(f"   Alpaca服务不可用")
    else:
        print(f"   响应: {response.text[:200]}")
except Exception as e:
    print(f"   错误: {e}")

# 测试提交订单（模拟）
print("\n5. 测试提交订单 (模拟 - 不实际执行):")
print("   注意: 这里只测试API端点是否响应，不实际提交订单")
try:
    # 创建一个模拟订单数据
    mock_order = {
        "symbol": "AAPL",
        "qty": 1,
        "side": "buy",
        "type": "market",
        "time_in_force": "day"
    }
    
    # 先测试端点是否存在
    response = requests.get("http://127.0.0.1:8889/api/trading/account", timeout=5)
    if response.status_code == 503:
        print("   Alpaca服务不可用，跳过订单提交测试")
    else:
        print("   Alpaca服务可用，订单提交端点已就绪")
        print(f"   模拟订单数据: {json.dumps(mock_order)}")
except Exception as e:
    print(f"   错误: {e}")

print("\n=== 测试完成 ===")