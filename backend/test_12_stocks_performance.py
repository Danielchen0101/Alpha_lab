#!/usr/bin/env python3
"""
测试12支股票的性能
"""

import time
import requests
import json

def test_12_stocks_performance():
    """测试12支股票的性能"""
    print("=" * 80)
    print("12支股票性能测试")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889/api"
    
    # 12支测试股票（建议的最终列表）
    test_symbols_12 = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", 
        "META", "JPM", "JNJ", "WMT", "V", "UNH"
    ]
    
    print(f"测试股票列表 ({len(test_symbols_12)}支):")
    for i, symbol in enumerate(test_symbols_12):
        print(f"  {i+1:2d}. {symbol}")
    
    # 测试1: 首次请求（无缓存）
    print("\n1. 首次请求测试 (无缓存)")
    print("-" * 80)
    
    start_time = time.time()
    try:
        # 构建查询参数
        symbols_param = ','.join(test_symbols_12)
        response = requests.get(f"{base_url}/market/stocks?dashboard=true&symbols={symbols_param}", timeout=30)
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            print(f"[SUCCESS] 请求成功 ({elapsed:.2f}秒)")
            print(f"  股票数量: {data.get('count', 0)}")
            print(f"  数据源: {data.get('source', 'Unknown')}")
            print(f"  是否成功: {data.get('success', 'N/A')}")
            print(f"  API返回耗时: {data.get('elapsed', 0):.2f}秒")
            
            # 检查数据完整性
            stocks = data.get('stocks', [])
            if stocks:
                print(f"  数据完整性检查:")
                print(f"    成功获取: {len(stocks)}支")
                
                # 检查核心字段
                missing_fields = []
                for stock in stocks[:3]:  # 检查前3支
                    required = ['symbol', 'price', 'changePercent', 'marketCap', 'sector']
                    missing = [field for field in required if stock.get(field) is None]
                    if missing:
                        missing_fields.append(f"{stock.get('symbol')}: {missing}")
                
                if missing_fields:
                    print(f"    [WARNING] 字段缺失: {missing_fields}")
                else:
                    print(f"    [SUCCESS] 核心字段完整")
                
                # 显示示例数据
                print(f"  示例数据 (前3支):")
                for stock in stocks[:3]:
                    marketcap = stock.get('marketCap')
                    if marketcap and marketcap >= 1e12:
                        marketcap_str = f"${marketcap/1e12:.2f}T"
                    elif marketcap and marketcap >= 1e9:
                        marketcap_str = f"${marketcap/1e9:.2f}B"
                    else:
                        marketcap_str = f"${marketcap or 0:,.0f}"
                    
                    print(f"    {stock.get('symbol')}: ${stock.get('price')} "
                          f"(涨跌: {stock.get('changePercent', 0):.2f}%, "
                          f"市值: {marketcap_str}, "
                          f"行业: {stock.get('sector', 'N/A')})")
            
            # 性能评估
            if elapsed > 10:
                print(f"  [WARNING] 性能警告: 请求耗时较长 ({elapsed:.2f}秒)")
            elif elapsed > 5:
                print(f"  [INFO] 性能一般: 请求耗时 ({elapsed:.2f}秒)")
            else:
                print(f"  [SUCCESS] 性能良好: 请求快速 ({elapsed:.2f}秒)")
                
            # 检查是否可能超时
            if elapsed > 25:
                print(f"  [CRITICAL] 接近超时: 请求耗时接近30秒限制 ({elapsed:.2f}秒)")
                
        else:
            print(f"[ERROR] 请求失败: {response.status_code}")
            print(f"  响应: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        elapsed = time.time() - start_time
        print(f"[ERROR] 请求超时 ({elapsed:.2f}秒)")
        print(f"  12支股票在当前配置下仍然会超时")
    except Exception as e:
        elapsed = time.time() - start_time
        print(f"[ERROR] 请求异常: {str(e)} ({elapsed:.2f}秒)")
    
    # 测试2: 缓存后请求
    print("\n2. 缓存后请求测试")
    print("-" * 80)
    
    for i in range(2):
        print(f"\n  第 {i+1} 次缓存请求:")
        start_time = time.time()
        try:
            symbols_param = ','.join(test_symbols_12)
            response = requests.get(f"{base_url}/market/stocks?dashboard=true&symbols={symbols_param}", timeout=10)
            elapsed = time.time() - start_time
            
            if response.status_code == 200:
                data = response.json()
                print(f"  [SUCCESS] 请求成功 ({elapsed:.2f}秒)")
                
                # 检查缓存效果
                if elapsed < 0.5:
                    print(f"  [SUCCESS] 缓存效果显著 (<0.5秒)")
                elif elapsed < 1.0:
                    print(f"  [INFO] 缓存效果一般 ({elapsed:.2f}秒)")
                else:
                    print(f"  [WARNING] 缓存效果不明显 ({elapsed:.2f}秒)")
            else:
                print(f"  [ERROR] 请求失败: {response.status_code}")
                
        except Exception as e:
            print(f"  [ERROR] 请求异常: {str(e)}")
    
    # 测试3: 与8支股票对比
    print("\n3. 与8支股票性能对比")
    print("-" * 80)
    
    test_symbols_8 = test_symbols_12[:8]
    
    print(f"  8支股票: {test_symbols_8}")
    print(f"  12支股票: {test_symbols_12}")
    
    # 理论计算
    print(f"\n  理论性能计算:")
    print(f"  假设每支股票平均耗时: 0.34秒 (基于8支测试)")
    print(f"  并发数: 4线程")
    
    print(f"\n  8支股票:")
    print(f"    批次: 8 ÷ 4 = 2批")
    print(f"    每批耗时: max(4支股票的耗时)")
    print(f"    总耗时: 2批 × 0.34秒 ≈ 0.68秒 (实际: 2.71秒)")
    
    print(f"\n  12支股票:")
    print(f"    批次: 12 ÷ 4 = 3批")
    print(f"    每批耗时: max(4支股票的耗时)")
    print(f"    总耗时: 3批 × 0.34秒 ≈ 1.02秒 (实际测试中...)")
    
    # 实际测试8支对比
    print(f"\n  实际测试8支股票:")
    start_time = time.time()
    try:
        symbols_param = ','.join(test_symbols_8)
        response = requests.get(f"{base_url}/market/stocks?dashboard=true&symbols={symbols_param}", timeout=10)
        elapsed_8 = time.time() - start_time
        
        if response.status_code == 200:
            print(f"    耗时: {elapsed_8:.2f}秒")
        else:
            print(f"    测试失败: {response.status_code}")
    except Exception as e:
        print(f"    测试异常: {str(e)}")
    
    print(f"\n4. 稳定性评估")
    print("-" * 80)
    
    print(f"  评估标准:")
    print(f"  ✅ 优秀: <5秒，无超时风险")
    print(f"  ⚠️  可接受: 5-10秒，接近但未超时")
    print(f"  ❌ 不可接受: >10秒，有超时风险")
    
    print(f"\n  建议:")
    print(f"  如果12支股票耗时 <5秒: 可以设置为默认")
    print(f"  如果12支股票耗时 5-10秒: 需要进一步优化")
    print(f"  如果12支股票耗时 >10秒: 保持8支，继续优化")
    
    print(f"\n" + "=" * 80)

if __name__ == "__main__":
    test_12_stocks_performance()