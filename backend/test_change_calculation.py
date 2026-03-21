import requests
import json
from datetime import datetime

# 测试1 Year数据并计算Change和Period Change
url = "http://127.0.0.1:8890/api/market/history/AAPL"
params = {
    'interval': 'D',
    'range': '1year'
}

print("测试1 Year数据Change计算...")
print(f"请求URL: {url}")
print(f"参数: {params}")

try:
    response = requests.get(url, params=params, timeout=10)
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        historical_data = data.get('data', [])
        
        if len(historical_data) >= 2:
            # 获取第一个点和最后一个点
            first_point = historical_data[0]
            last_point = historical_data[-1]
            
            # 转换时间戳为日期
            first_date = datetime.fromtimestamp(first_point['timestamp'])
            last_date = datetime.fromtimestamp(last_point['timestamp'])
            
            # 获取价格
            first_close = first_point['close']
            last_close = last_point['close']
            
            print(f"\n=== 1 Year数据点分析 ===")
            print(f"数据总数: {len(historical_data)}")
            print(f"第一个点: {first_date.strftime('%Y-%m-%d')}, Close: ${first_close:.2f}")
            print(f"最后一个点: {last_date.strftime('%Y-%m-%d')}, Close: ${last_close:.2f}")
            
            # 计算Change和Period Change %
            change = last_close - first_close
            change_percent = (change / first_close) * 100
            
            print(f"\n=== 计算结果 ===")
            print(f"Change = 最后一个点 - 第一个点")
            print(f"       = {last_close:.2f} - {first_close:.2f}")
            print(f"       = {change:.2f}")
            
            print(f"\nPeriod Change % = (Change / 第一个点) × 100")
            print(f"                = ({change:.2f} / {first_close:.2f}) × 100")
            print(f"                = {change_percent:.2f}%")
            
            # 获取实时价格对比
            print(f"\n=== 实时价格对比 ===")
            stock_url = "http://127.0.0.1:8890/api/market/stock/AAPL"
            stock_response = requests.get(stock_url, timeout=10)
            
            if stock_response.status_code == 200:
                stock_data = stock_response.json()
                real_time_price = stock_data.get('price', 0)
                print(f"实时价格 (stockData.price): ${real_time_price:.2f}")
                print(f"图表最后一个点价格: ${last_close:.2f}")
                print(f"差异: ${real_time_price - last_close:.2f}")
                
                if abs(real_time_price - last_close) > 0.1:
                    print(f"⚠️  注意：实时价格与图表最后一个点价格不一致！")
                    print(f"   如果使用real_time_price计算Change，结果会不同")
                    
                    # 使用real_time_price重新计算
                    change_with_realtime = real_time_price - first_close
                    change_percent_with_realtime = (change_with_realtime / first_close) * 100
                    
                    print(f"\n使用实时价格计算:")
                    print(f"Change = {real_time_price:.2f} - {first_close:.2f} = {change_with_realtime:.2f}")
                    print(f"Period Change % = ({change_with_realtime:.2f} / {first_close:.2f}) × 100 = {change_percent_with_realtime:.2f}%")
                    
                    print(f"\n差异分析:")
                    print(f"Change差异: {change_with_realtime - change:.2f}")
                    print(f"Period Change %差异: {change_percent_with_realtime - change_percent:.2f}%")
                else:
                    print(f"✅ 实时价格与图表最后一个点价格基本一致")
            else:
                print(f"无法获取实时价格: {stock_response.status_code}")
        else:
            print(f"❌ 数据不足，需要至少2个数据点，当前只有{len(historical_data)}个")
    else:
        print(f"❌ 请求失败: {response.text}")
        
except Exception as e:
    print(f"❌ 测试失败: {e}")