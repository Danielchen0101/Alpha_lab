#!/usr/bin/env python3
"""
最终验证修复后的Dashboard
"""

import requests
import json

def final_verification_fixed():
    """最终验证修复后的Dashboard"""
    print("最终验证：修复后的Dashboard")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    # 获取当前Dashboard数据
    print("\n1. 获取当前Dashboard数据")
    print("-" * 40)
    
    try:
        response = requests.get(f"{base_url}/market/stocks?dashboard=true", timeout=20)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            selection_info = data.get('selection_info', {})
            
            print(f"  股票总数: {len(stocks)}支")
            print(f"  数据源: {data.get('source', 'N/A')}")
            print(f"  耗时: {data.get('elapsed', 0):.2f}秒")
            
            # 显示完整股票列表（去重后）
            print(f"\n  完整15支股票列表（去重后）:")
            symbols = []
            unique_stocks = []
            for stock in stocks:
                symbol = stock.get('symbol')
                if symbol not in symbols:
                    symbols.append(symbol)
                    unique_stocks.append(stock)
            
            for i, stock in enumerate(unique_stocks, 1):
                symbol = stock.get('symbol')
                price = stock.get('price')
                change_percent = stock.get('changePercent', 0)
                sector = stock.get('sector', 'N/A')[:20]
                
                print(f"    {i:2d}. {symbol}: ${price or 'N/A'} "
                      f"({change_percent:+.2f}%), "
                      f"行业: {sector}")
            
            # 检查重复股票
            print(f"\n2. 检查重复股票")
            print("-" * 40)
            
            from collections import Counter
            all_symbols = [s.get('symbol') for s in stocks]
            symbol_counts = Counter(all_symbols)
            duplicates = {symbol: count for symbol, count in symbol_counts.items() if count > 1}
            
            if duplicates:
                print(f"  [ERROR] 仍有重复股票:")
                for symbol, count in duplicates.items():
                    print(f"    {symbol}: 出现{count}次")
            else:
                print(f"  [SUCCESS] 没有重复股票")
            
            # 检查TSLA
            print(f"\n3. 检查TSLA")
            print("-" * 40)
            
            tsla_stock = next((s for s in stocks if s.get('symbol') == 'TSLA'), None)
            if tsla_stock:
                print(f"  [SUCCESS] TSLA在最终15支股票中")
                print(f"     位置: 第{symbols.index('TSLA') + 1}个")
                print(f"     价格: ${tsla_stock.get('price')}")
                print(f"     涨跌幅: {tsla_stock.get('changePercent', 0):+.2f}%")
                print(f"     分类: {'上涨' if tsla_stock.get('changePercent', 0) > 0.1 else '下跌' if tsla_stock.get('changePercent', 0) < -0.1 else '平盘'}")
            else:
                print(f"  [ERROR] TSLA不在最终15支股票中")
            
            # 分类统计
            print(f"\n4. 涨跌分类统计")
            print("-" * 40)
            
            # 使用去重后的股票
            gainers = [s for s in unique_stocks if s.get('changePercent', 0) > 0.1]
            losers = [s for s in unique_stocks if s.get('changePercent', 0) < -0.1]
            neutral = [s for s in unique_stocks if -0.1 <= s.get('changePercent', 0) <= 0.1]
            
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
            print(f"\n5. 详细分类列表")
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
            
            # 前端显示逻辑说明
            print(f"\n6. 前端显示逻辑说明")
            print("-" * 40)
            
            print(f"  Top Gainers卡片:")
            print(f"    - 显示前8条上涨股票")
            print(f"    - 如果超过8条，显示'+X more gainers'提示")
            print(f"    - 用户可以通过滚动查看所有")
            print(f"    - 底部显示总数: {len(gainers)} gainers")
            
            print(f"\n  Top Losers卡片:")
            print(f"    - 显示前8条下跌股票")
            print(f"    - 如果超过8条，显示'+X more losers'提示")
            print(f"    - 用户可以通过滚动查看所有")
            print(f"    - 底部显示总数: {len(losers)} losers")
            
            print(f"\n  Summary Cards:")
            print(f"    - Market Gainers: {len(gainers)}支")
            print(f"    - Market Losers: {len(losers)}支")
            print(f"    - 与Top Gainers/Losers卡片的总数一致")
            
            # 总结
            print(f"\n7. 总结")
            print("-" * 40)
            
            print(f"  修复完成验证:")
            print(f"    1. 股票数量: {len(unique_stocks)}支 [{'SUCCESS' if len(unique_stocks) == 15 else 'ERROR'}]")
            print(f"    2. 重复股票: {len(duplicates)}个 [{'ERROR' if duplicates else 'SUCCESS'}]")
            print(f"    3. TSLA包含: {'是' if tsla_stock else '否'} [{'SUCCESS' if tsla_stock else 'ERROR'}]")
            print(f"    4. 涨跌分布: {len(gainers)}涨{len(losers)}跌{len(neutral)}平")
            print(f"    5. 前端显示: 前8条 + 滚动提示")
            
        else:
            print(f"  请求失败: {response.status_code}")
            
    except Exception as e:
        print(f"  验证异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    final_verification_fixed()