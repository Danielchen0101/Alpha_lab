#!/usr/bin/env python3
"""
调试Alpaca返回的历史数据
查看不同股票的实际数据差异
"""

import requests
import json
import time
import datetime

def debug_alpaca_historical_data():
    """调试Alpaca历史数据"""
    
    symbols = ['NVDA', 'AAPL', 'WMT', 'HD']
    
    print("=" * 80)
    print("调试Alpaca历史数据 - 检查不同股票的差异")
    print("=" * 80)
    
    # 模拟后端get_alpaca_history_for_backtest的逻辑
    for symbol in symbols:
        print(f"\n=== 调试股票 {symbol} ===")
        
        # 构建Alpaca请求
        timeframe = "1Day"
        start_date = "2025-04-11"  # 1年前
        end_date = "2026-04-11"    # 今天
        
        # 转换时间为UTC格式
        start_dt = datetime.datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.datetime.strptime(end_date, '%Y-%m-%d')
        
        # Alpaca需要UTC时间
        start_date_utc = start_dt.replace(hour=0, minute=0, second=0)
        end_date_utc = end_dt.replace(hour=23, minute=59, second=59)
        
        # 假设使用Alpaca API密钥（实际需要从配置读取）
        # 这里只是调试，我们直接调用后端看看日志
        
        print(f"请求时间范围: {start_date} 到 {end_date}")
        print(f"Symbol: {symbol}")
        print(f"Timeframe: {timeframe}")
        
        # 调用后端backtest接口，但我们需要查看Alpaca的实际响应
        # 我们可以直接调用后端的backtest接口，然后查看日志
        
        backtest_config = {
            "strategy": "moving_average",
            "startDate": start_date,
            "endDate": end_date,
            "initialCapital": 10000,
            "symbols": [symbol],
            "dataMode": "real",
            "parameters": {
                "shortMaPeriod": 20,
                "longMaPeriod": 50
            }
        }
        
        url = "http://127.0.0.1:8892/api/backtest/run"
        
        try:
            print(f"发送backtest请求...")
            response = requests.post(url, json=backtest_config, timeout=60)
            
            if response.status_code == 200:
                data = response.json()
                result = data.get('result', {})
                results_data = result.get('results', {})
                
                print(f"Backtest结果:")
                print(f"  Total Return: {results_data.get('totalReturn')}%")
                print(f"  Sharpe Ratio: {results_data.get('sharpeRatio')}")
                print(f"  Max Drawdown: {results_data.get('maxDrawdown')}%")
                print(f"  Trades: {results_data.get('trades')}")
                
                # 检查是否有交易发生
                trades_list = result.get('trades', [])
                print(f"  交易数量: {len(trades_list)}")
                if trades_list:
                    print(f"  第一笔交易: {trades_list[0]}")
                    print(f"  最后一笔交易: {trades_list[-1]}")
                
                # 检查equity curve
                equity_curve = results_data.get('equityCurve', [])
                print(f"  Equity curve数据点: {len(equity_curve)}")
                if equity_curve:
                    print(f"  初始equity: {equity_curve[0].get('equity')}")
                    print(f"  最终equity: {equity_curve[-1].get('equity')}")
                    
                    # 检查equity值是否变化
                    equities = [point.get('equity', 0) for point in equity_curve]
                    unique_equities = len(set(round(e, 2) for e in equities))
                    print(f"  唯一equity值数量: {unique_equities}")
                    
                    if unique_equities <= 1:
                        print("  ⚠️ 警告: equity值没有变化或变化很小!")
            else:
                print(f"请求失败: {response.status_code}")
                print(f"响应: {response.text[:500]}")
                
        except Exception as e:
            print(f"异常: {e}")

def test_historical_data_directly():
    """直接测试历史数据获取"""
    
    print("\n" + "=" * 80)
    print("直接测试历史数据差异")
    print("=" * 80)
    
    # 由于我们不能直接访问Alpaca API密钥，我们可以检查后端日志
    # 或者模拟一些逻辑
    
    # 让我们检查不同股票的价格数据应该不同
    # 创建一个简单的测试来验证不同股票应该有不同价格
    
    symbols = ['NVDA', 'AAPL', 'WMT', 'HD']
    
    # 这些是知名股票的典型价格范围（近似值）
    typical_prices = {
        'NVDA': 800,  # NVIDIA高价股
        'AAPL': 170,  # Apple中等价股  
        'WMT': 60,    # Walmart低价股
        'HD': 350     # Home Depot中等价股
    }
    
    print("\n典型价格对比（仅供参考）:")
    for symbol in symbols:
        print(f"{symbol}: 典型价格 ~${typical_prices.get(symbol, 'N/A')}")
    
    print("\n如果所有股票的backtest结果相同，可能原因:")
    print("1. Alpaca API返回了相同/模拟的数据")
    print("2. API密钥无效，返回了默认/模拟数据")
    print("3. 策略逻辑有bug，没有正确处理不同股票的数据")
    print("4. 所有股票的历史数据确实巧合地产生了相同结果")

def check_backend_logs():
    """检查后端日志中的Alpaca响应"""
    
    print("\n" + "=" * 80)
    print("检查后端日志提示")
    print("=" * 80)
    
    print("需要查看后端控制台日志，寻找以下信息:")
    print("1. [Alpaca Backtest Bars] 行 - 显示Alpaca请求详情")
    print("2. [Optimization Alpaca] 行 - 显示API响应状态")
    print("3. bars数组长度 - 应该是252个左右（一年交易日）")
    print("4. 第一条和最后一条bar的价格 - 应该因股票而异")
    
    print("\n典型问题迹象:")
    print("- 'API密钥未配置' - 使用模拟数据")
    print("- 'bars数组为空' - 没有历史数据")
    print("- 所有股票返回相同价格 - API故障或模拟数据")

if __name__ == "__main__":
    print("开始调试Alpaca历史数据问题")
    print("确保后端服务正在运行 (端口 8892)")
    
    debug_alpaca_historical_data()
    test_historical_data_directly()
    check_backend_logs()
    
    print("\n" + "=" * 80)
    print("调试建议:")
    print("=" * 80)
    print("1. 检查后端控制台日志，查看Alpaca实际返回的数据")
    print("2. 验证Alpaca API密钥是否有效配置")
    print("3. 检查不同股票的price字段是否真的不同")
    print("4. 如果使用模拟/默认数据，所有股票会有相同结果")