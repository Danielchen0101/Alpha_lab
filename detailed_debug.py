#!/usr/bin/env python3
"""
详细调试：直接调用后端函数查看问题
"""

import sys
import os

# 添加backend目录到Python路径
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

def detailed_debug():
    """详细调试"""
    print("Detailed Debug: Direct Function Calls")
    print("=" * 80)
    
    try:
        # 导入必要的模块
        from start_quant_backend import (
            fetch_alpaca_stock_data_snapshot,
            ai_provider_config_state,
            alpaca_config_state
        )
        
        symbol = "AAPL"
        
        print(f"\n1. Checking configuration states...")
        print(f"Alpaca config state: {alpaca_config_state}")
        print(f"AI provider config state: {ai_provider_config_state}")
        
        print(f"\n2. Testing fetch_alpaca_stock_data_snapshot for {symbol}...")
        data_dict, errors = fetch_alpaca_stock_data_snapshot([symbol])
        
        print(f"Errors: {errors}")
        if symbol.upper() in data_dict:
            data = data_dict[symbol.upper()]
            print(f"\nSnapshots data for {symbol}:")
            print(f"  Price: {data.get('price')}")
            print(f"  Change %: {data.get('changePercent')}")
            print(f"  Volume: {data.get('volume')}")
            print(f"  Day High: {data.get('dayHigh')}")
            print(f"  Day Low: {data.get('dayLow')}")
            print(f"  Previous Close: {data.get('previousClose')}")
            print(f"  Data Source: {data.get('dataSource')}")
            print(f"  Session Type: {data.get('sessionType')}")
            print(f"  All keys: {list(data.keys())}")
        else:
            print(f"No data for {symbol}")
            
        # 3. 测试analyze_trend_with_deepseek直接调用
        print(f"\n3. Testing analyze_trend_with_deepseek directly...")
        
        # 首先获取数据
        if symbol.upper() in data_dict:
            market_data = data_dict[symbol.upper()]
            
            # 获取公司信息
            from start_quant_backend import fetch_finnhub_profile
            company_info, company_error = fetch_finnhub_profile(symbol)
            print(f"Company info error: {company_error}")
            print(f"Company info: {company_info}")
            
            # 获取新闻数据
            from start_quant_backend import analyze_news_for_stock
            news_data = analyze_news_for_stock(symbol)
            print(f"News data: {news_data}")
            
            # 现在调用AI分析函数
            from start_quant_backend import analyze_trend_with_deepseek
            
            print(f"\nCalling analyze_trend_with_deepseek with:")
            print(f"  Symbol: {symbol}")
            print(f"  Market data type: {type(market_data)}")
            print(f"  Market data keys: {list(market_data.keys()) if market_data else 'None'}")
            print(f"  News data type: {type(news_data)}")
            print(f"  Company info type: {type(company_info)}")
            
            try:
                result = analyze_trend_with_deepseek(symbol, market_data, news_data, company_info)
                print(f"\nAI analysis result: {result}")
            except Exception as e:
                print(f"Error calling analyze_trend_with_deepseek: {e}")
                import traceback
                traceback.print_exc()
        else:
            print(f"Cannot test AI analysis - no market data for {symbol}")
            
    except Exception as e:
        print(f"Import/execution error: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 80)
    print("Debug Complete")

if __name__ == "__main__":
    detailed_debug()