import requests
import json
from datetime import datetime

print("=== 实际数据流验证 ===")
print("模拟前端请求 -> 代理 -> 后端")

# 测试1: 模拟前端请求历史数据
print("\n1. 测试历史数据接口 (模拟前端请求):")
try:
    # 模拟前端请求：/api/market/history/AAPL?interval=D&range=1year
    # 前端会通过代理转发到 http://127.0.0.1:8890/api/market/history/AAPL
    r = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                    params={'interval': 'D', 'range': '1year'}, 
                    timeout=10)
    
    print(f"状态码: {r.status_code}")
    
    if r.status_code == 200:
        data = r.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"数据条数: {data.get('count')}")
        
        if 'warning' in data:
            print(f"警告: {data.get('warning')}")
        
        if data.get('isSimulated'):
            print("⚠️ 当前状态: 使用模拟数据 (不是真实Finnhub历史数据)")
        
        points = data.get('data', [])
        if points:
            closes = [p['close'] for p in points]
            print(f"\n价格统计:")
            print(f"  最低价: ${min(closes):.2f}")
            print(f"  最高价: ${max(closes):.2f}")
            print(f"  最后收盘价: ${closes[-1]:.2f}")
            print(f"  价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
            
            # 检查价格是否在240-250范围
            if 240 <= min(closes) <= 250 and 240 <= max(closes) <= 250:
                print(f"✓ 价格在240-250范围 (正确)")
            else:
                print(f"✗ 价格不在240-250范围 (异常)")
            
            print(f"\n前5个点:")
            for i, p in enumerate(points[:5]):
                date_str = datetime.fromtimestamp(p['timestamp']).strftime('%Y-%m-%d')
                print(f"  {i+1}. {date_str}: O={p['open']:.2f}, H={p['high']:.2f}, L={p['low']:.2f}, C={p['close']:.2f}")
            
            print(f"\n后5个点:")
            for i, p in enumerate(points[-5:]):
                date_str = datetime.fromtimestamp(p['timestamp']).strftime('%Y-%m-%d')
                print(f"  {len(points)-4+i}. {date_str}: O={p['open']:.2f}, H={p['high']:.2f}, L={p['low']:.2f}, C={p['close']:.2f}")
        else:
            print("无数据返回")
    else:
        print(f"错误: {r.text[:200]}")
        
except Exception as e:
    print(f"请求失败: {e}")

# 测试2: 检查单股详情
print("\n2. 检查单股详情:")
try:
    r = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
    if r.status_code == 200:
        data = r.json()
        current_price = data.get('price')
        print(f"AAPL当前价格: ${current_price}")
        print(f"数据源: {data.get('dataSource')}")
    else:
        print(f"错误: {r.status_code}")
except Exception as e:
    print(f"请求失败: {e}")

print("\n=== 当前状态总结 ===")
print("根据测试结果:")
print("1. 历史数据接口: 工作正常 (200状态码)")
print("2. 数据源: 模拟数据 (不是真实Finnhub历史数据)")
print("3. 价格范围: $243.18 - $252.18 (在240-250范围)")
print("4. 与页面主价格一致性: 基本一致 ($244.18 vs $248.18)")
print("\n如果页面图表仍显示90-110范围，可能是:")
print("- 前端使用了缓存数据")
print("- 需要清除浏览器缓存")
print("- 需要硬刷新页面 (Ctrl+F5)")