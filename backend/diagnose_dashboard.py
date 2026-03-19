#!/usr/bin/env python3
"""
诊断Dashboard显示问题
"""

import requests
import json

def diagnose_dashboard():
    """诊断Dashboard显示问题"""
    print("诊断Dashboard显示问题")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    # 获取当前Dashboard数据
    print("\n1. 获取当前Dashboard数据")
    print("-" * 40)
    
    try:
        response = requests.get(f"{base_url}/market/stocks?dashboard=true", timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            selection_info = data.get('selection_info', {})
            
            print(f"  股票总数: {len(stocks)}支")
            print(f"  数据源: {data.get('source', 'N/A')}")
            
            # 显示完整股票列表
            print(f"\n  完整15支股票列表:")
            symbols = []
            for i, stock in enumerate(stocks, 1):
                symbol = stock.get('symbol')
                symbols.append(symbol)
                price = stock.get('price')
                change_percent = stock.get('changePercent', 0)
                sector = stock.get('sector', 'N/A')[:20]
                
                print(f"    {i:2d}. {symbol}: ${price or 'N/A'} "
                      f"({change_percent:+.2f}%), "
                      f"行业: {sector}")
            
            # 检查TSLA
            print(f"\n2. 检查TSLA")
            print("-" * 40)
            
            tsla_stock = next((s for s in stocks if s.get('symbol') == 'TSLA'), None)
            if tsla_stock:
                print(f"  ✅ TSLA在最终15支股票中")
                print(f"     价格: ${tsla_stock.get('price')}")
                print(f"     涨跌幅: {tsla_stock.get('changePercent', 0):+.2f}%")
                print(f"     行业: {tsla_stock.get('sector', 'N/A')}")
                print(f"     分类: {'上涨' if tsla_stock.get('changePercent', 0) > 0.1 else '下跌' if tsla_stock.get('changePercent', 0) < -0.1 else '平盘'}")
            else:
                print(f"  ❌ TSLA不在最终15支股票中")
                print(f"     可能原因:")
                print(f"     1. TSLA数据获取失败")
                print(f"     2. 筛选算法bug")
                print(f"     3. 候选池中没有TSLA")
            
            # 分类统计
            print(f"\n3. 涨跌分类统计")
            print("-" * 40)
            
            gainers = [s for s in stocks if s.get('changePercent', 0) > 0.1]
            losers = [s for s in stocks if s.get('changePercent', 0) < -0.1]
            neutral = [s for s in stocks if -0.1 <= s.get('changePercent', 0) <= 0.1]
            
            print(f"  实际上涨 (>0.1%): {len(gainers)}支")
            print(f"  实际下跌 (<-0.1%): {len(losers)}支")
            print(f"  实际平盘 (±0.1%): {len(neutral)}支")
            
            # 显示筛选信息
            if selection_info:
                print(f"\n  筛选算法报告:")
                print(f"    总计: {selection_info.get('total', 0)}支")
                print(f"    上涨: {selection_info.get('gainers', 0)}支")
                print(f"    下跌: {selection_info.get('losers', 0)}支")
                print(f"    平盘: {selection_info.get('neutral', 0)}支")
                print(f"    科技股: {selection_info.get('tech_stocks', 0)}支")
                print(f"    必须包含: {selection_info.get('must_have_included', [])}")
            
            # 详细分类列表
            print(f"\n4. 详细分类列表")
            print("-" * 40)
            
            print(f"  上涨股票 ({len(gainers)}支):")
            for i, stock in enumerate(sorted(gainers, key=lambda x: x.get('changePercent', 0), reverse=True), 1):
                print(f"    {i:2d}. {stock.get('symbol')}: {stock.get('changePercent', 0):+.2f}% (${stock.get('price')})")
            
            print(f"\n  下跌股票 ({len(losers)}支):")
            for i, stock in enumerate(sorted(losers, key=lambda x: x.get('changePercent', 0)), 1):
                print(f"    {i:2d}. {stock.get('symbol')}: {stock.get('changePercent', 0):+.2f}% (${stock.get('price')})")
            
            print(f"\n  平盘股票 ({len(neutral)}支):")
            for i, stock in enumerate(sorted(neutral, key=lambda x: abs(x.get('changePercent', 0))), 1):
                print(f"    {i:2d}. {stock.get('symbol')}: {stock.get('changePercent', 0):+.2f}% (${stock.get('price')})")
            
            # 检查重复股票
            print(f"\n5. 检查重复股票")
            print("-" * 40)
            
            from collections import Counter
            symbol_counts = Counter(symbols)
            duplicates = {symbol: count for symbol, count in symbol_counts.items() if count > 1}
            
            if duplicates:
                print(f"  ⚠️ 发现重复股票:")
                for symbol, count in duplicates.items():
                    print(f"    {symbol}: 出现{count}次")
                print(f"  原因: 筛选算法bug，需要修复")
            else:
                print(f"  ✅ 没有重复股票")
            
            # 检查候选池
            print(f"\n6. 检查候选池")
            print("-" * 40)
            
            # 获取候选池信息
            try:
                debug_response = requests.get(f"{base_url}/debug/symbols", timeout=5)
                if debug_response.status_code == 200:
                    debug_data = debug_response.json()
                    candidate_pool = debug_data.get('CANDIDATE_STOCKS', [])
                    must_have = debug_data.get('MUST_HAVE_STOCKS', [])
                    
                    print(f"  候选池大小: {len(candidate_pool)}支")
                    print(f"  必须包含: {must_have}")
                    
                    # 检查TSLA是否在候选池
                    if 'TSLA' in candidate_pool:
                        print(f"  ✅ TSLA在候选池中")
                    else:
                        print(f"  ❌ TSLA不在候选池中")
                else:
                    print(f"  无法获取候选池信息: {debug_response.status_code}")
            except:
                print(f"  无法连接调试端点")
            
        else:
            print(f"  请求失败: {response.status_code}")
            print(f"  响应: {response.text[:200]}")
            
    except Exception as e:
        print(f"  诊断异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    diagnose_dashboard()