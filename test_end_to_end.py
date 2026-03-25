#!/usr/bin/env python3
"""
端到端测试 - 模拟完整的请求响应流程
"""

import json
from datetime import datetime, timedelta
import random
import math

def simulate_backend_response():
    """模拟后端响应"""
    print("=== 模拟后端响应 ===")
    
    # 模拟请求参数
    request_data = {
        "symbol": "AAPL",
        "strategy": "moving_average",
        "startDate": "2025-02-01",
        "endDate": "2025-03-01",
        "initialCapital": 100000,
        "dataMode": "simulated"
    }
    
    print(f"请求参数: {json.dumps(request_data, indent=2)}")
    
    # 提取参数
    start_date = request_data.get("startDate", "2025-02-01")
    end_date = request_data.get("endDate", "2025-03-01")
    strategy = request_data.get("strategy", "moving_average")
    
    # 生成chartData
    try:
        start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        days_diff = (end_dt - start_dt).days
        
        if days_diff <= 0:
            print(f"[ERROR] 无效的日期范围: {days_diff}天")
            return None
        
        print(f"[INFO] 日期范围: {days_diff}天")
        
        chart_data = []
        
        for day_index in range(days_diff + 1):
            current_date = (start_dt + timedelta(days=day_index)).strftime("%Y-%m-%d")
            
            # 生成价格数据
            if strategy == 'moving_average':
                base_trend = 150.0 + (day_index * 0.3)
                noise = random.uniform(-2.0, 2.0)
                close_price = base_trend + noise
                
                sma20 = base_trend + random.uniform(-1.0, 1.0) if day_index >= 19 else None
                sma50 = base_trend + random.uniform(-1.5, 1.5) if day_index >= 49 else None
            else:
                if day_index == 0:
                    close_price = 150.0
                else:
                    change = random.uniform(-1.5, 1.5)
                    close_price = chart_data[-1]["close"] + change
                
                sma20 = close_price + random.uniform(-1.0, 1.0) if day_index >= 19 else None
                sma50 = close_price + random.uniform(-1.5, 1.5) if day_index >= 49 else None
            
            # 生成信号
            signal = 0
            if day_index > 0 and sma20 is not None:
                prev_price = chart_data[-1]["close"] if chart_data else close_price
                if prev_price <= (sma20 - 0.5) and close_price > sma20:
                    signal = 1
                elif prev_price >= (sma20 + 0.5) and close_price < sma20:
                    signal = -1
            
            chart_item = {
                "date": current_date,
                "close": round(close_price, 2),
                "signal": signal,
                "volume": random.randint(1000000, 5000000)
            }
            
            if sma20 is not None:
                chart_item["sma20"] = round(sma20, 2)
            if sma50 is not None:
                chart_item["sma50"] = round(sma50, 2)
            
            chart_data.append(chart_item)
        
        # 构建响应
        response = {
            "backtestId": "test-123",
            "status": "completed",
            "results": {
                "totalReturn": 15.5,
                "sharpeRatio": 1.2,
                "maxDrawdown": -8.3,
                "winRate": 58.7,
                "trades": 24,
                "annualizedReturn": 25.1,
                "profitLoss": 15500,
                "calmarRatio": 2.19,
                "avgReturnPerTrade": 645.83,
                "volatility": 12.5,
                "sortinoRatio": 1.8,
                "profitFactor": 1.6,
                "expectancy": 1.5,
                "exposure": 45.2,
                "chartData": chart_data,
                "tradesList": []
            },
            "parameters": {
                "symbols": ["AAPL"],
                "strategy": strategy,
                "startDate": start_date,
                "endDate": end_date,
                "initialCapital": 100000,
                "period": f"{start_date} to {end_date}",
                "dataMode": "simulated",
                "dataModeDisplay": "Simulated Data",
                "dataSource": "Simulated"
            }
        }
        
        print(f"\n[RESPONSE] 后端响应:")
        print(f"  chartData长度: {len(chart_data)}")
        print(f"  第一条数据日期: {chart_data[0]['date'] if chart_data else '无数据'}")
        print(f"  最后一条数据日期: {chart_data[-1]['date'] if chart_data else '无数据'}")
        
        # 检查数据问题
        print(f"\n[DATA CHECK] 数据检查:")
        
        # 1. 检查是否有无效数据
        valid_items = []
        for i, item in enumerate(chart_data):
            if not isinstance(item.get('close'), (int, float)):
                print(f"  第{i}条数据: close无效 - {item.get('close')}")
            elif not isinstance(item.get('volume'), (int, float)):
                print(f"  第{i}条数据: volume无效 - {item.get('volume')}")
            elif not isinstance(item.get('date'), str):
                print(f"  第{i}条数据: date无效 - {item.get('date')}")
            else:
                valid_items.append(item)
        
        print(f"  有效数据条数: {len(valid_items)} / {len(chart_data)}")
        
        # 2. 检查数值范围
        if valid_items:
            closes = [item['close'] for item in valid_items]
            volumes = [item['volume'] for item in valid_items]
            
            print(f"  close范围: {min(closes):.2f} - {max(closes):.2f}")
            print(f"  volume范围: {min(volumes):,} - {max(volumes):,}")
            
            # 检查是否有异常值
            if any(v <= 0 for v in volumes):
                print(f"  ⚠️ 警告: 有volume<=0的数据")
            if any(c <= 0 for c in closes):
                print(f"  ⚠️ 警告: 有close<=0的数据")
        
        return response
        
    except Exception as e:
        print(f"[ERROR] 生成响应时发生异常: {e}")
        import traceback
        traceback.print_exc()
        return None

def simulate_frontend_processing(response):
    """模拟前端处理"""
    print("\n=== 模拟前端处理 ===")
    
    if not response or 'results' not in response:
        print("[ERROR] 响应数据无效")
        return
    
    chart_data = response['results'].get('chartData', [])
    print(f"前端接收到的chartData长度: {len(chart_data)}")
    
    if not chart_data:
        print("[ERROR] chartData为空")
        return
    
    # 模拟TradingChart组件的数据处理
    print("\n[FRONTEND] TradingChart组件数据处理:")
    
    # 1. 检查数据格式
    sample_item = chart_data[0]
    print(f"  数据字段: {list(sample_item.keys())}")
    
    # 2. 模拟prices计算
    prices = [item.get('close') for item in chart_data]
    valid_prices = [p for p in prices if isinstance(p, (int, float))]
    
    print(f"  prices有效数据: {len(valid_prices)} / {len(prices)}")
    if valid_prices:
        min_price = min(valid_prices)
        max_price = max(valid_prices)
        print(f"  price范围: {min_price:.2f} - {max_price:.2f}")
    
    # 3. 模拟volumes计算 - 这里有问题！
    volumes = [item.get('volume', 0) for item in chart_data]
    
    # 错误的过滤方式（原代码）
    volumes_wrong = [v for v in volumes if v]  # filter(Boolean)的等价写法
    print(f"  volumes错误过滤后: {len(volumes_wrong)} / {len(volumes)}")
    
    # 正确的过滤方式
    volumes_correct = [v for v in volumes if isinstance(v, (int, float))]
    print(f"  volumes正确过滤后: {len(volumes_correct)} / {len(volumes)}")
    
    if volumes_correct:
        max_volume = max(volumes_correct)
        print(f"  maxVolume: {max_volume:,}")
    
    # 4. 检查hasVolumeData
    has_volume_data = any(item.get('volume', 0) > 0 for item in chart_data)
    print(f"  hasVolumeData: {has_volume_data}")
    
    # 5. 检查hasSMA20/hasSMA50
    has_sma20 = any('sma20' in item for item in chart_data)
    has_sma50 = any('sma50' in item for item in chart_data)
    print(f"  hasSMA20: {has_sma20}")
    print(f"  hasSMA50: {has_sma50}")
    
    # 6. 模拟chartData准备
    print(f"\n[FRONTEND] chartData准备:")
    prepared_data = []
    
    for i, item in enumerate(chart_data):
        # 模拟volume颜色计算
        volume_color = '#cccccc'
        if item.get('volume', 0) > 0:
            if i == 0:
                volume_color = '#cccccc'
            else:
                current_close = item.get('close', 0)
                prev_close = chart_data[i-1].get('close', 0)
                volume_color = '#95de64' if current_close >= prev_close else '#ff7875'
        
        prepared_item = {
            **item,
            "buySignal": item.get('close') if item.get('signal') == 1 else None,
            "sellSignal": item.get('close') if item.get('signal') == -1 else None,
            "volumeColor": volume_color,
            "volumeDisplay": item.get('volume', 0)
        }
        
        prepared_data.append(prepared_item)
    
    print(f"  准备后的数据长度: {len(prepared_data)}")
    
    # 检查准备后的数据问题
    if prepared_data:
        # 检查是否有NaN或undefined
        problematic_items = []
        for i, item in enumerate(prepared_data):
            if any(v is None or (isinstance(v, float) and math.isnan(v)) for v in item.values() if not isinstance(v, str)):
                problematic_items.append((i, item))
        
        if problematic_items:
            print(f"  [WARNING] 有问题的数据项: {len(problematic_items)}个")
            for i, item in problematic_items[:3]:  # 只显示前3个
                print(f"    第{i}项: {item}")
        else:
            print(f"  [OK] 所有数据项都有效")

def main():
    """主函数"""
    print("开始端到端测试...\n")
    
    # 模拟后端响应
    response = simulate_backend_response()
    
    if response:
        # 模拟前端处理
        simulate_frontend_processing(response)
    
    print("\n=== 问题诊断 ===")
    print("可能的问题:")
    print("1. 后端返回的chartData可能只有1条数据")
    print("2. 数据格式问题（NaN、undefined、类型错误）")
    print("3. 前端volumes过滤逻辑问题（filter(Boolean)会过滤掉0）")
    print("4. 数据字段缺失（sma20、sma50可能不存在）")
    print("5. 日期格式问题")
    
    print("\n建议的调试步骤:")
    print("1. 在后端添加调试日志，确认chartData的长度和内容")
    print("2. 在前端TradingChart组件添加调试日志")
    print("3. 检查网络请求，确认前端实际接收到的数据")
    print("4. 检查浏览器控制台是否有错误信息")

if __name__ == "__main__":
    main()