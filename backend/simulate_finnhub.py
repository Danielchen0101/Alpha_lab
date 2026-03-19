#!/usr/bin/env python3
"""
模拟Finnhub API返回的数据结构
"""

def simulate_finnhub():
    """模拟Finnhub API"""
    print("模拟Finnhub API返回的数据结构")
    print("=" * 60)
    
    # 根据Finnhub文档，quote API返回的数据结构
    print("Finnhub quote API文档说明:")
    print("  URL: https://finnhub.io/docs/api/quote")
    print("  返回字段:")
    print("    c: Current price")
    print("    h: High price of the day")
    print("    l: Low price of the day")
    print("    o: Open price of the day")
    print("    pc: Previous close price")
    print("    t: Timestamp")
    
    # 模拟实际返回的数据
    print(f"\n模拟Finnhub quote API返回的数据:")
    simulated_data = {
        'c': 249.94,      # current price
        'h': 254.23,      # high price of the day
        'l': 249.51,      # low price of the day
        'o': 253.50,      # open price
        'pc': 254.23,     # previous close
        't': 1710796800   # timestamp
    }
    
    print(f"  {simulated_data}")
    
    # 检查我们的代码如何处理这些数据
    print(f"\n我们的代码处理逻辑:")
    print(f"  quote_data.get('h'): {simulated_data.get('h')}")
    print(f"  quote_data.get('high'): {simulated_data.get('high')}")
    print(f"  quote_data.get('h') or quote_data.get('high') or None: {simulated_data.get('h') or simulated_data.get('high') or None}")
    
    print(f"\n  quote_data.get('l'): {simulated_data.get('l')}")
    print(f"  quote_data.get('low'): {simulated_data.get('low')}")
    print(f"  quote_data.get('l') or quote_data.get('low') or None: {simulated_data.get('l') or simulated_data.get('low') or None}")
    
    # 问题分析
    print(f"\n问题分析:")
    print(f"  1. 如果Finnhub返回的是'h'和'l'，我们的代码应该能正确获取")
    print(f"  2. 如果返回的是'high'和'low'，代码也能处理")
    print(f"  3. 如果返回0或null，前端会显示'--'")
    
    print(f"\n可能的解决方案:")
    print(f"  1. 确保后端正确设置了dayHigh和dayLow字段")
    print(f"  2. 如果值为0，前端显示'--'是预期的")
    print(f"  3. 检查前端是否真的读取了这些字段")

if __name__ == "__main__":
    simulate_finnhub()