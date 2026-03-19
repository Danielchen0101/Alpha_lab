#!/usr/bin/env python3
"""
全面验证Dashboard数据准确性
重点检查Largest Cap $48.5T问题
"""

import requests
import json
import time

def verify_dashboard_data():
    """全面验证Dashboard数据"""
    print("全面验证Dashboard数据准确性")
    print("=" * 80)
    
    base_url = "http://127.0.0.1:8889/api"
    
    try:
        # 获取Dashboard数据（不使用缓存）
        print("\n1. 获取当前Dashboard实际使用的15支股票")
        print("-" * 80)
        
        timestamp = int(time.time() * 1000)
        response = requests.get(f"{base_url}/market/stocks?dashboard=true&_t={timestamp}", timeout=20)
        
        if response.status_code == 200:
            data = response.json()
            stocks = data.get('stocks', [])
            selection_info = data.get('selection_info', {})
            
            print(f"  股票总数: {len(stocks)}支")
            print(f"  数据源: {data.get('source', 'N/A')}")
            print(f"  耗时: {data.get('elapsed', 0):.2f}秒")
            
            # 检查重复股票
            symbols = [s.get('symbol') for s in stocks]
            if len(symbols) != len(set(symbols)):
                print(f"  ⚠️ 发现重复股票!")
                from collections import Counter
                symbol_counts = Counter(symbols)
                for symbol, count in symbol_counts.items():
                    if count > 1:
                        print(f"    {symbol}: 出现{count}次")
            
            # 打印每一支股票的完整数据
            print(f"\n2. 15支股票完整数据表")
            print("-" * 80)
            print(f"{'Symbol':<8} {'Name':<25} {'Price':<10} {'Change':<10} {'Change%':<10} {'MarketCap(原始)':<20} {'MarketCap(转换)':<20} {'Sector':<20}")
            print("-" * 80)
            
            total_market_cap = 0
            gainers = 0
            losers = 0
            total_change_percent = 0
            
            for stock in stocks:
                symbol = stock.get('symbol', 'N/A')
                name = stock.get('name', 'N/A')[:20]
                price = stock.get('price', 0)
                change = stock.get('change', 0)
                change_percent = stock.get('changePercent', 0)
                market_cap_raw = stock.get('marketCap')
                market_cap_formatted = market_cap_raw
                sector = stock.get('sector', 'N/A')[:15]
                
                # 统计
                if change_percent > 0.1:
                    gainers += 1
                elif change_percent < -0.1:
                    losers += 1
                
                total_change_percent += change_percent
                
                if market_cap_raw:
                    total_market_cap += market_cap_raw
                    # 转换为万亿显示
                    market_cap_trillion = market_cap_raw / 1_000_000_000_000
                    market_cap_display = f"{market_cap_trillion:.2f}T"
                else:
                    market_cap_display = "N/A"
                
                print(f"{symbol:<8} {name:<25} ${price:<9.2f} ${change:<9.2f} {change_percent:<9.2f}% {str(market_cap_raw)[:15]:<20} {market_cap_display:<20} {sector:<20}")
            
            # 找出Largest Cap
            print(f"\n3. Largest Cap 手工核算")
            print("-" * 80)
            
            stocks_with_market_cap = [s for s in stocks if s.get('marketCap')]
            if stocks_with_market_cap:
                # 按marketCap排序
                sorted_by_market_cap = sorted(stocks_with_market_cap, 
                                            key=lambda x: x.get('marketCap', 0), 
                                            reverse=True)
                
                print(f"  Market Cap排名前5:")
                for i, stock in enumerate(sorted_by_market_cap[:5], 1):
                    market_cap = stock.get('marketCap', 0)
                    market_cap_trillion = market_cap / 1_000_000_000_000
                    print(f"    {i}. {stock.get('symbol')}: ${market_cap_trillion:.2f}T (原始值: {market_cap})")
                
                largest_cap_stock = sorted_by_market_cap[0]
                largest_cap_value = largest_cap_stock.get('marketCap', 0)
                largest_cap_trillion = largest_cap_value / 1_000_000_000_000
                
                print(f"\n  Largest Cap应该是: {largest_cap_stock.get('symbol')} ${largest_cap_trillion:.2f}T")
                
                # 检查TSM
                tsm_stock = next((s for s in stocks if s.get('symbol') == 'TSM'), None)
                if tsm_stock:
                    tsm_market_cap = tsm_stock.get('marketCap', 0)
                    tsm_trillion = tsm_market_cap / 1_000_000_000_000
                    print(f"  TSM实际market cap: ${tsm_trillion:.2f}T (原始值: {tsm_market_cap})")
                    
                    if tsm_trillion > 10:  # 如果超过10T，可能有问题
                        print(f"  ⚠️  TSM ${tsm_trillion:.2f}T 看起来可疑!")
                        print(f"     可能原因:")
                        print(f"     1. 单位换算错误 (百万→美元需要×1,000,000)")
                        print(f"     2. 数据源错误")
                        print(f"     3. 缓存了旧数据")
                else:
                    print(f"  ⚠️  TSM不在当前15支股票中!")
                    print(f"     但页面显示TSM $48.5T，说明:")
                    print(f"     1. 前端可能使用了旧数据")
                    print(f"     2. 缓存没有正确清除")
                    print(f"     3. 数据源不一致")
            else:
                print(f"  ❌ 没有股票有market cap数据")
            
            # 计算其他summary
            print(f"\n4. 所有summary手工核算")
            print("-" * 80)
            
            # 4.1 Total Symbols
            total_symbols = len(stocks)
            print(f"  Total Symbols:")
            print(f"    计算值: {total_symbols}")
            print(f"    页面应显示: {total_symbols}")
            
            # 4.2 Market Gainers/Losers
            print(f"\n  Market Gainers/Losers:")
            print(f"    Gainers (>0.1%): {gainers}")
            print(f"    Losers (<-0.1%): {losers}")
            print(f"    Neutral (±0.1%): {total_symbols - gainers - losers}")
            
            # 4.3 Average Change
            avg_change_percent = total_change_percent / total_symbols if total_symbols > 0 else 0
            print(f"\n  Average Change:")
            print(f"    计算值: {avg_change_percent:.2f}%")
            
            # 4.4 Total Market Cap
            total_market_cap_trillion = total_market_cap / 1_000_000_000_000
            print(f"\n  Total Market Cap:")
            print(f"    计算值: ${total_market_cap_trillion:.2f}T")
            print(f"    原始值总和: {total_market_cap}")
            
            # 4.5 Largest Move
            if stocks:
                largest_move_stock = max(stocks, key=lambda x: abs(x.get('changePercent', 0)))
                largest_move_change = largest_move_stock.get('changePercent', 0)
                print(f"\n  Largest Move:")
                print(f"    股票: {largest_move_stock.get('symbol')}")
                print(f"    涨跌幅: {largest_move_change:.2f}%")
                print(f"    颜色: {'绿色' if largest_move_change > 0 else '红色' if largest_move_change < 0 else '灰色'}")
            
            # 4.6 Sector Distribution
            print(f"\n  Sector Distribution:")
            from collections import Counter
            sectors = [s.get('sector', 'Unknown') for s in stocks]
            sector_counter = Counter(sectors)
            
            for sector, count in sector_counter.most_common():
                percentage = (count / total_symbols) * 100
                print(f"    {sector}: {count}支 ({percentage:.1f}%)")
            
            # 4.7 Market Breadth (涨跌比)
            market_breadth = gainers - losers
            print(f"\n  Market Breadth (涨跌比):")
            print(f"    Gainers - Losers = {gainers} - {losers} = {market_breadth}")
            
            # 检查Top Gainers/Losers排序
            print(f"\n5. Top Gainers/Losers排序检查")
            print("-" * 80)
            
            # Top Gainers (按changePercent降序)
            gainers_stocks = [s for s in stocks if s.get('changePercent', 0) > 0.1]
            sorted_gainers = sorted(gainers_stocks, key=lambda x: x.get('changePercent', 0), reverse=True)
            
            print(f"  Top Gainers (前{min(8, len(sorted_gainers))}条):")
            for i, stock in enumerate(sorted_gainers[:8], 1):
                print(f"    {i}. {stock.get('symbol')}: {stock.get('changePercent', 0):+.2f}%")
            
            # Top Losers (按changePercent升序，即下跌最多的在前)
            losers_stocks = [s for s in stocks if s.get('changePercent', 0) < -0.1]
            sorted_losers = sorted(losers_stocks, key=lambda x: x.get('changePercent', 0))
            
            print(f"\n  Top Losers (前{min(8, len(sorted_losers))}条):")
            for i, stock in enumerate(sorted_losers[:8], 1):
                print(f"    {i}. {stock.get('symbol')}: {stock.get('changePercent', 0):+.2f}%")
            
            # 检查TSM是否在列表中
            print(f"\n6. TSM状态检查")
            print("-" * 80)
            
            tsm_in_list = any(s.get('symbol') == 'TSM' for s in stocks)
            print(f"  TSM在当前15支中: {'是' if tsm_in_list else '否'}")
            
            if tsm_in_list:
                tsm_stock = next(s for s in stocks if s.get('symbol') == 'TSM')
                print(f"  TSM数据:")
                print(f"    价格: ${tsm_stock.get('price', 0):.2f}")
                print(f"    涨跌幅: {tsm_stock.get('changePercent', 0):.2f}%")
                print(f"    Market Cap原始值: {tsm_stock.get('marketCap', 'N/A')}")
                
                if tsm_stock.get('marketCap'):
                    tsm_cap = tsm_stock.get('marketCap')
                    tsm_trillion = tsm_cap / 1_000_000_000_000
                    print(f"    Market Cap显示值: ${tsm_trillion:.2f}T")
                    
                    if tsm_trillion > 10:
                        print(f"    ⚠️  问题: TSM ${tsm_trillion:.2f}T 明显过高!")
                        print(f"       可能原因分析:")
                        print(f"       1. 单位换算错误: 原始值可能是百万，需要×1,000,000")
                        print(f"       2. 但我们已经做了这个转换，所以可能是:")
                        print(f"          a) 转换了两次 (×1,000,000 ×1,000,000)")
                        print(f"          b) 数据源本身错误")
                        print(f"          c) 缓存了错误数据")
            
            # 总结
            print(f"\n7. 验证结论")
            print("-" * 80)
            
            print(f"  需要检查的问题:")
            print(f"  1. Largest Cap显示TSM $48.5T是否正确?")
            print(f"  2. TSM是否真的在当前15支股票池里?")
            print(f"  3. 如果TSM不在，为什么页面显示它?")
            print(f"  4. 所有summary数据是否与页面显示一致?")
            
            print(f"\n  建议下一步:")
            print(f"  1. 检查前端market cap格式化函数")
            print(f"  2. 检查后端market cap单位换算")
            print(f"  3. 清除所有缓存重新测试")
            print(f"  4. 对比页面实际显示与计算结果")
            
        else:
            print(f"  请求失败: {response.status_code}")
            print(f"  响应: {response.text[:200]}")
            
    except Exception as e:
        print(f"  验证异常: {str(e)}")
        import traceback
        traceback.print_exc()
    
    print(f"\n" + "=" * 80)

if __name__ == "__main__":
    verify_dashboard_data()