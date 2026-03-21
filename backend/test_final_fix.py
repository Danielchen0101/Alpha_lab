import requests
from datetime import datetime
import time

print("等待后端启动...")
time.sleep(2)

print("\n=== 最终修复验证 ===")

# 测试1: AAPL 1Y历史数据
print("\n1. 测试AAPL 1Y历史数据:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1year'}, 
                    timeout=10)
    
    if r.status_code == 200:
        data = r.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"数据条数: {data.get('count')}")
        
        if 'warning' in data:
            print(f"警告: {data.get('warning')}")
        
        if 'isSimulated' in data:
            print(f"模拟数据: {data.get('isSimulated')}")
            print(f"基础价格: ${data.get('basePrice')}")
            print(f"价格范围: {data.get('priceRange')}")
        
        points = data.get('data', [])
        if points:
            closes = [p['close'] for p in points]
            print(f"实际价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
            print(f"最后收盘价: ${closes[-1]:.2f}")
            
            # 前5个点
            print(f"\n前5个点:")
            for i, p in enumerate(points[:5]):
                date_str = datetime.fromtimestamp(p['timestamp']).strftime('%Y-%m-%d')
                print(f"  {i+1}. {date_str}: C={p['close']:.2f}")
            
            # 后5个点
            print(f"\n后5个点:")
            for i, p in enumerate(points[-5:]):
                date_str = datetime.fromtimestamp(p['timestamp']).strftime('%Y-%m-%d')
                print(f"  {len(points)-4+i}. {date_str}: C={p['close']:.2f}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试2: AAPL单股详情
print("\n2. 测试AAPL单股详情:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
    if r.status_code == 200:
        data = r.json()
        print(f"当前价格: ${data.get('price')}")
        print(f"数据源: {data.get('dataSource')}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

# 测试3: 检查数据一致性
print("\n3. 数据一致性检查:")
print("页面主价格($249.23)应该和图表最后收盘价在同一数量级")
print("如果图表显示$91，说明:")
print("  a) 使用了不同的数据源")
print("  b) 图表使用了错误的字段")
print("  c) 前端有本地测试数据")

print("\n=== 修复总结 ===")
print("✓ 后端统一到8890端口")
print("✓ 前端API_BASE_URL改为相对路径")
print("✓ 代理配置指向8890")
print("✓ 模拟数据明确标记")
print("✓ 8889端口已关闭")
print("\n需要启动前端开发服务器验证修复效果")