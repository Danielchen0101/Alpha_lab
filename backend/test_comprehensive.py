#!/usr/bin/env python3
"""
综合测试后端API
"""

import requests
import json
import time

def test_market_data():
    """测试市场数据API"""
    print("=== 测试市场数据API ===")
    
    # 测试获取股票列表
    url = "http://127.0.0.1:8889/api/market/stocks"
    params = {"symbols": "AAPL,MSFT"}
    
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"获取到 {len(data.get('stocks', []))} 只股票")
            
            for stock in data.get('stocks', []):
                print(f"\n股票: {stock.get('symbol')}")
                print(f"  价格: ${stock.get('price')}")
                print(f"  涨跌幅: {stock.get('changePercent')}%")
                print(f"  成交量: {stock.get('volume')}")
                print(f"  日高: ${stock.get('dayHigh')}")
                print(f"  日低: ${stock.get('dayLow')}")
                print(f"  数据源: {stock.get('dataSource')}")
                print(f"  名称: {stock.get('name')}")
                print(f"  行业: {stock.get('sector')}")
                
                # 检查关键字段是否存在
                missing_fields = []
                if stock.get('dayHigh') is None:
                    missing_fields.append('dayHigh')
                if stock.get('dayLow') is None:
                    missing_fields.append('dayLow')
                if stock.get('dataSource') is None:
                    missing_fields.append('dataSource')
                
                if missing_fields:
                    print(f"  缺失字段: {missing_fields}")
                    
            return True
        else:
            print(f"错误: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"异常: {e}")
        return False

def test_ai_analysis():
    """测试AI分析API"""
    print("\n=== 测试AI分析API ===")
    
    url = "http://127.0.0.1:8889/api/ai/analyze/single"
    payload = {"symbol": "AAPL"}
    
    try:
        start_time = time.time()
        response = requests.post(url, json=payload, timeout=60)
        elapsed = time.time() - start_time
        
        print(f"响应时间: {elapsed:.2f}秒")
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # 检查关键字段
            required_fields = ['success', 'symbol', 'trend', 'overallScore', 
                              'newsSentiment', 'eventRisk', 'topNews', 'provenance']
            
            print("\n关键字段检查:")
            for field in required_fields:
                value = data.get(field)
                print(f"  {field}: {value}")
                
                # 特殊检查
                if field == 'topNews':
                    if value and isinstance(value, dict):
                        print(f"    title: {value.get('title')}")
                        print(f"    source: {value.get('source')}")
                    else:
                        print(f"    WARNING: topNews不是字典或为空")
                
                if field == 'provenance':
                    if value and isinstance(value, dict):
                        print(f"    marketData: {value.get('marketData')}")
                        print(f"    news: {value.get('news')}")
                        print(f"    aiAnalysis: {value.get('aiAnalysis')}")
            
            # 检查6维度分数
            print("\n6维度分数:")
            dimension_fields = ['trendScore', 'momentumScore', 'volumeScore', 
                               'volatilityScore', 'structureScore', 'newsScore']
            for field in dimension_fields:
                value = data.get(field)
                print(f"  {field}: {value}")
                
                # 检查分数是否在合理范围
                if value is not None and (value < 0 or value > 100):
                    print(f"    WARNING: {field}分数超出范围 (0-100): {value}")
            
            # 检查数据完整性
            print("\n数据完整性检查:")
            if data.get('success'):
                print("  ✓ AI分析成功")
            else:
                print("  ✗ AI分析失败")
                
            if data.get('topNews') and data['topNews'].get('title'):
                print("  ✓ 有新闻标题")
            else:
                print("  ✗ 无新闻标题")
                
            if data.get('provenance'):
                print("  ✓ 有数据来源信息")
            else:
                print("  ✗ 无数据来源信息")
                
            return True
        else:
            print(f"错误: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"异常: {e}")
        return False

def test_volume_formatting():
    """测试成交量格式化"""
    print("\n=== 测试成交量格式化 ===")
    
    # 测试不同成交量的格式化
    test_volumes = [
        1000,           # 1K
        1500000,        # 1.5M
        2500000000,     # 2.5B
        1234567,        # 1.2M
        999999,         # 1.0M
        1000000000000,  # 1000.0B
    ]
    
    for volume in test_volumes:
        # 前端格式化逻辑: (volume / 1000000).toFixed(1) + 'M'
        formatted = f"{(volume / 1000000):.1f}M"
        
        # 更智能的格式化
        if volume < 1000:
            smart_formatted = f"{volume}"
        elif volume < 1000000:
            smart_formatted = f"{(volume / 1000):.1f}K"
        elif volume < 1000000000:
            smart_formatted = f"{(volume / 1000000):.1f}M"
        else:
            smart_formatted = f"{(volume / 1000000000):.1f}B"
        
        print(f"原始: {volume:,} -> 前端格式: {formatted} -> 智能格式: {smart_formatted}")

if __name__ == '__main__':
    print("开始综合测试...")
    
    # 测试市场数据
    market_ok = test_market_data()
    
    # 测试AI分析
    ai_ok = test_ai_analysis()
    
    # 测试成交量格式化
    test_volume_formatting()
    
    print("\n=== 测试总结 ===")
    print(f"市场数据测试: {'通过' if market_ok else '失败'}")
    print(f"AI分析测试: {'通过' if ai_ok else '失败'}")
    
    if market_ok and ai_ok:
        print("所有测试通过!")
    else:
        print("有测试失败，需要进一步排查")