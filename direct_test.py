#!/usr/bin/env python3
"""
直接测试AI分析函数
"""

import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# 模拟必要的全局变量
import time
import json

# 导入函数
from start_quant_backend import analyze_news_for_stock, analyze_trend_with_deepseek, analyze_trend_locally

def test_direct():
    """直接测试函数"""
    print("Direct Test of AI Analysis Functions")
    print("=" * 80)
    
    symbols = ["AAPL", "MSFT", "TSLA"]
    
    for symbol in symbols:
        print(f"\n{'='*60}")
        print(f"Testing {symbol}")
        print(f"{'='*60}")
        
        # 1. 测试新闻分析
        print(f"\n1. Testing analyze_news_for_stock('{symbol}')...")
        try:
            news_data = analyze_news_for_stock(symbol)
            print(f"News Data:")
            print(f"  sentiment: {news_data.get('sentiment')}")
            print(f"  eventRisk: {news_data.get('eventRisk')}")
            print(f"  newsCount: {news_data.get('newsCount')}")
            print(f"  hasNews: {news_data.get('hasNews')}")
            print(f"  newsSource: {news_data.get('newsSource')}")
        except Exception as e:
            print(f"Error in analyze_news_for_stock: {e}")
        
        # 2. 创建模拟市场数据
        print(f"\n2. Creating mock market data...")
        market_data = {
            'price': 259.22,
            'changePercent': -0.46,
            'volume': 1154691,
            'dataSource': 'Alpaca'
        }
        
        # 3. 创建模拟公司信息
        print(f"\n3. Creating mock company info...")
        company_info = {
            'name': f'{symbol} Inc.',
            'finnhubSector': 'Technology',
            'finnhubIndustry': 'Technology'
        }
        
        # 4. 测试本地规则分析
        print(f"\n4. Testing analyze_trend_locally('{symbol}', market_data, news_data, company_info)...")
        try:
            local_result = analyze_trend_locally(symbol, market_data, news_data, company_info)
            print(f"Local Analysis Result:")
            print(f"  trendLabel: {local_result.get('trendLabel')}")
            print(f"  trendScore: {local_result.get('trendScore')}")
            print(f"  trendConfidence: {local_result.get('trendConfidence')}")
            print(f"  scannerReason: {local_result.get('scannerReason', '')[:100]}...")
        except Exception as e:
            print(f"Error in analyze_trend_locally: {e}")
        
        # 5. 测试DeepSeek分析
        print(f"\n5. Testing analyze_trend_with_deepseek('{symbol}', market_data, news_data, company_info)...")
        try:
            deepseek_result = analyze_trend_with_deepseek(symbol, market_data, news_data, company_info)
            print(f"DeepSeek Analysis Result:")
            print(f"  trendLabel: {deepseek_result.get('trendLabel')}")
            print(f"  trendScore: {deepseek_result.get('trendScore')}")
            print(f"  trendConfidence: {deepseek_result.get('trendConfidence')}")
            print(f"  aiReasoning: {deepseek_result.get('aiReasoning', '')[:100]}..." if deepseek_result.get('aiReasoning') else "  aiReasoning: None")
            
            # 检查是否有错误
            if 'error' in deepseek_result:
                print(f"  ERROR: {deepseek_result.get('error')}")
        except Exception as e:
            print(f"Error in analyze_trend_with_deepseek: {e}")
            import traceback
            traceback.print_exc()
    
    print(f"\n{'='*80}")
    print("Direct Test Complete")

if __name__ == "__main__":
    test_direct()