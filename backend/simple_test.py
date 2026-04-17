#!/usr/bin/env python3
"""
简单测试 - 直接测试修复的字段
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8889"

def test_market_scanner():
    """测试市场扫描器"""
    print("测试市场扫描器API")
    print("=" * 80)
    
    # 测试数据
    payload = {
        "symbols": ["AAPL", "MSFT", "GOOGL"],
        "maxSymbols": 3
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/ai/market/scanner",
            json=payload,
            timeout=30
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('success'):
                results = data.get('results', [])
                print(f"扫描结果数量: {len(results)}")
                
                # 检查每个结果的字段
                for i, result in enumerate(results[:2]):  # 只检查前2个
                    print(f"\n结果 {i+1} - {result.get('symbol')}:")
                    print(f"  price: {result.get('price')}")
                    print(f"  changePct: {result.get('changePct')}")
                    print(f"  changePercent: {result.get('changePercent')}")
                    print(f"  sector: {result.get('sector')}")
                    print(f"  newsSentiment: {result.get('newsSentiment')}")
                    print(f"  eventRisk: {result.get('eventRisk')}")
                    print(f"  topCatalyst: {result.get('topCatalyst')}")
                    
                    # 验证字段
                    issues = []
                    if result.get('changePct') is None:
                        issues.append("changePct为null")
                    if not result.get('sector') or result.get('sector') == 'Unknown':
                        issues.append(f"sector为{result.get('sector')}")
                    if not result.get('newsSentiment'):
                        issues.append("newsSentiment为空")
                    
                    if issues:
                        print(f"  ⚠️ 问题: {', '.join(issues)}")
                    else:
                        print(f"  ✅ 所有字段正常")
            else:
                print(f"API返回失败: {data.get('message')}")
        else:
            print(f"HTTP错误: {response.text[:200]}")
            
    except Exception as e:
        print(f"测试失败: {e}")

def test_single_symbol():
    """测试单个symbol"""
    print("\n\n测试单个symbol数据获取")
    print("=" * 80)
    
    symbol = "AAPL"
    
    # 模拟get_stock_data_for_scanner的逻辑
    print(f"模拟获取 {symbol} 数据:")
    
    # 这里我们无法直接调用Python函数，但我们可以通过API测试
    # 实际上，scanner API内部会调用get_stock_data_for_scanner
    
    test_market_scanner()

def main():
    """主函数"""
    print("修复字段验证测试")
    print("=" * 80)
    
    # 检查后端是否运行
    try:
        health = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"后端健康检查: {health.status_code}")
        if health.status_code == 200:
            print(f"后端响应: {health.json()}")
    except:
        print("⚠️ 后端可能未运行在8889端口")
        print("请先启动后端: python start_quant_backend_repaired.py")
        return
    
    # 测试市场扫描器
    test_market_scanner()
    
    print("\n" + "=" * 80)
    print("测试完成")
    print("=" * 80)

if __name__ == "__main__":
    main()