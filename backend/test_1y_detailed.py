import requests
from datetime import datetime
import json

print("测试AAPL 1Y历史数据详细返回...")
print("请求: GET /api/market/history/AAPL?interval=D&range=1year")

try:
    response = requests.get('http://127.0.0.1:8890/api/market/history/AAPL', 
                          params={'interval': 'D', 'range': '1year'}, 
                          timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"数据源: {data.get('dataSource')}")
        print(f"数据条数: {data.get('count')}")
        
        if 'warning' in data:
            print(f"警告: {data.get('warning')}")
        
        data_points = data.get('data', [])
        if data_points:
            print(f"\n=== 前10个点 ===")
            for i, point in enumerate(data_points[:10]):
                time_str = datetime.fromtimestamp(point['timestamp']).strftime('%Y-%m-%d')
                print(f"{i+1:3d}. 时间: {time_str}, O: {point['open']:7.2f}, H: {point['high']:7.2f}, L: {point['low']:7.2f}, C: {point['close']:7.2f}")
            
            print(f"\n=== 后10个点 ===")
            for i, point in enumerate(data_points[-10:]):
                time_str = datetime.fromtimestamp(point['timestamp']).strftime('%Y-%m-%d')
                print(f"{len(data_points)-9+i:3d}. 时间: {time_str}, O: {point['open']:7.2f}, H: {point['high']:7.2f}, L: {point['low']:7.2f}, C: {point['close']:7.2f}")
            
            print(f"\n=== 价格统计 ===")
            closes = [p['close'] for p in data_points]
            print(f"最低价: ${min(closes):.2f}")
            print(f"最高价: ${max(closes):.2f}")
            print(f"平均价: ${sum(closes)/len(closes):.2f}")
            print(f"最后收盘价: ${closes[-1]:.2f}")
            print(f"价格范围: ${min(closes):.2f} - ${max(closes):.2f}")
            
            # 检查是否是模拟数据特征
            price_range = max(closes) - min(closes)
            if price_range < 50:  # 模拟数据波动小
                print(f"\n⚠️ 疑似模拟数据特征:")
                print(f"  价格波动范围仅${price_range:.2f}")
                print(f"  AAPL一年波动通常>$100")
            
            # 检查与当前价格的一致性
            print(f"\n=== 检查单股详情当前价格 ===")
            try:
                stock_resp = requests.get('http://127.0.0.1:8890/api/market/stock/AAPL', timeout=5)
                if stock_resp.status_code == 200:
                    stock_data = stock_resp.json()
                    current_price = stock_data.get('price')
                    print(f"AAPL当前价格: ${current_price}")
                    print(f"图表最后收盘价: ${closes[-1]:.2f}")
                    print(f"差异: ${abs(current_price - closes[-1]):.2f}")
                    
                    if abs(current_price - closes[-1]) > 50:
                        print(f"❌ 严重不一致! 差异超过$50")
                    elif abs(current_price - closes[-1]) > 10:
                        print(f"⚠️ 不一致! 差异超过$10")
                    else:
                        print(f"✓ 基本一致")
            except:
                print("无法获取单股详情")
                
        else:
            print("无数据返回")
    else:
        print(f"错误: {response.text[:200]}")
        
except Exception as e:
    print(f"请求失败: {e}")

print(f"\n{'='*80}")
print("检查后端日志中的历史数据请求...")
print("如果看到'[回退] 生成模拟历史数据'，说明使用了fallback数据")
print("如果看到'[Finnhub成功] 获取到 X 条真实数据'，说明使用了真实数据")