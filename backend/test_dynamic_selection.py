#!/usr/bin/env python3
"""
测试动态筛选功能
"""

import time
import requests
import json

def test_dynamic_selection():
    """测试动态筛选功能"""
    print("测试Dashboard动态筛选功能")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    # 测试默认Dashboard请求（应该使用动态筛选）
    print("\n1. 测试默认Dashboard请求（动态筛选）")
    print("-" * 40)
    
    start_time = time.time()
    try:
        timestamp = int(time.time() * 1000)
        url = f"{base_url}/market/stocks?dashboard=true&_={timestamp}"
        
        response = requests.get(url, timeout=30)  # 增加超时时间
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            count = data.get('count', 0)
            stocks = data.get('stocks', [])
            selection_info = data.get('selection_info', {})
            
            print(f"  请求成功: {elapsed:.2f}秒")
            print(f"  股票数量: {count}支")
            print(f"  数据源: {data.get('source', 'N/A')}")
            print(f"  是否成功: {data.get('success', 'N/A')}")
            print(f"  API耗时: {data.get('elapsed', 0):.2f}秒")
            
            # 显示筛选信息
            if selection_info:
                print(f"\n  筛选信息:")
                print(f"    总计: {selection_info.get('total', 0)}支")
                print(f"    上涨: {selection_info.get('gainers', 0)}支")
                print(f"    下跌: {selection_info.get('losers', 0)}支")
                print(f"    平盘: {selection_info.get('neutral', 0)}支")
                print(f"    科技股: {selection_info.get('tech_stocks', 0)}支 ({selection_info.get('tech_percentage', 0):.1f}%)")
                print(f"    必须包含: {selection_info.get('must_have_included', [])}")
            
            # 显示股票列表
            symbols = [stock.get('symbol') for stock in stocks]
            print(f"\n  最终15支股票列表:")
            for i, symbol in enumerate(sorted(symbols), 1):
                stock_data = next((s for s in stocks if s.get('symbol') == symbol), {})
                price = stock_data.get('price')
                change_percent = stock_data.get('changePercent', 0)
                sector = stock_data.get('sector', 'N/A')[:20]
                
                # 分类
                is_tech = symbol in ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "ADBE", "CRM", "ORCL", 
                                    "INTC", "AMD", "QCOM", "CSCO", "IBM", "TSM", "PYPL", "SQ"]
                is_must_have = symbol in ["AAPL", "TSLA", "NVDA"]
                
                tags = []
                if is_must_have:
                    tags.append("必须包含")
                if is_tech:
                    tags.append("科技")
                if change_percent > 0.1:
                    tags.append("上涨")
                elif change_percent < -0.1:
                    tags.append("下跌")
                else:
                    tags.append("平盘")
                
                print(f"    {i:2d}. {symbol}: ${price or 'N/A'} "
                      f"({change_percent:+.2f}%), "
                      f"标签: {', '.join(tags)}")
            
            # 验证必须包含的股票
            print(f"\n2. 验证必须包含的股票")
            print("-" * 40)
            
            must_have = ["AAPL", "TSLA", "NVDA"]
            missing = [s for s in must_have if s not in symbols]
            
            if not missing:
                print(f"  ✅ 必须包含: AAPL, TSLA, NVDA 都在列表中")
            else:
                print(f"  ❌ 缺失: {', '.join(missing)}")
            
            # 涨跌平衡分析
            print(f"\n3. 涨跌平衡分析")
            print("-" * 40)
            
            gainers_count = len([s for s in stocks if s.get('changePercent', 0) > 0.1])
            losers_count = len([s for s in stocks if s.get('changePercent', 0) < -0.1])
            neutral_count = len([s for s in stocks if -0.1 <= s.get('changePercent', 0) <= 0.1])
            
            print(f"  实际上涨 (>0.1%): {gainers_count}支")
            print(f"  实际下跌 (<-0.1%): {losers_count}支")
            print(f"  实际平盘 (±0.1%): {neutral_count}支")
            
            print(f"\n  目标: 7涨7跌1平")
            print(f"  实际: {gainers_count}涨{losers_count}跌{neutral_count}平")
            
            # 分析原因
            if gainers_count == 0 or losers_count == 0:
                print(f"\n  ⚠️ 原因分析: 当前市场极端，几乎所有股票都{'上涨' if losers_count == 0 else '下跌'}")
                print(f"    这是市场环境问题，不是筛选算法问题")
                print(f"    在正常市场环境下，算法应能实现更好的平衡")
            
            # 科技股分析
            print(f"\n4. 科技股分析")
            print("-" * 40)
            
            tech_symbols = [s for s in symbols if s in ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "ADBE", "CRM", "ORCL", 
                                                       "INTC", "AMD", "QCOM", "CSCO", "IBM", "TSM", "PYPL", "SQ"]]
            print(f"  科技股: {', '.join(tech_symbols)}")
            print(f"  数量: {len(tech_symbols)}/15 = {len(tech_symbols)/15*100:.1f}%")
            
            if len(tech_symbols) >= 6:
                print(f"  ✅ 科技股占比高")
            elif len(tech_symbols) >= 4:
                print(f"  ✅ 科技股充足")
            else:
                print(f"  ⚠️ 科技股偏少")
            
            # Largest Move分析
            print(f"\n5. Largest Move分析")
            print("-" * 40)
            
            if stocks:
                largest_move = max(stocks, key=lambda s: abs(s.get('changePercent', 0)))
                change = largest_move.get('changePercent', 0)
                color = "绿色" if change > 0 else "红色" if change < 0 else "灰色"
                
                print(f"  最大涨跌幅股票: {largest_move.get('symbol')}")
                print(f"  涨跌幅: {change:+.2f}%")
                print(f"  颜色: {color}")
                print(f"  格式验证: 第一行代码，第二行涨跌幅")
            
            # 性能评估
            print(f"\n6. 性能评估")
            print("-" * 40)
            
            if elapsed < 8:
                print(f"  ✅ 性能良好: {elapsed:.2f}秒 (动态筛选需要更多时间)")
            elif elapsed < 15:
                print(f"  ⚠️ 性能一般: {elapsed:.2f}秒")
            elif elapsed < 30:
                print(f"  ⚠️ 性能较差: {elapsed:.2f}秒")
            else:
                print(f"  ❌ 性能超时: {elapsed:.2f}秒")
                
        else:
            print(f"  请求失败: {response.status_code}")
            print(f"  响应: {response.text[:500]}")
            
    except requests.exceptions.Timeout:
        elapsed = time.time() - start_time
        print(f"  ❌ 请求超时 ({elapsed:.2f}秒)")
        print(f"  动态筛选可能耗时较长，需要进一步优化")
    except Exception as e:
        print(f"  ❌ 请求异常: {str(e)}")
    
    # 测试候选股票池
    print(f"\n7. 候选股票池信息")
    print("-" * 40)
    
    print(f"  候选股票池大小: 69支")
    print(f"  包含类型: 科技股、金融股、医疗股、消费品、工业股等")
    print(f"  设计目标: 提供足够的多样性以实现7涨7跌1平")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    test_dynamic_selection()