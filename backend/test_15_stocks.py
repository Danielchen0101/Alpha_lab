#!/usr/bin/env python3
"""
测试15支股票的性能和平衡性
"""

import time
import requests

def test_15_stocks():
    """测试15支股票"""
    print("测试15支股票的性能和平衡性")
    print("=" * 60)
    
    base_url = "http://127.0.0.1:8889/api"
    
    # 测试默认Dashboard请求（应该返回15支）
    print("\n1. 测试默认Dashboard请求（15支股票）")
    print("-" * 40)
    
    start_time = time.time()
    try:
        timestamp = int(time.time() * 1000)
        url = f"{base_url}/market/stocks?dashboard=true&_={timestamp}"
        
        response = requests.get(url, timeout=20)  # 增加超时时间
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            count = data.get('count', 0)
            stocks = data.get('stocks', [])
            
            print(f"  请求成功: {elapsed:.2f}秒")
            print(f"  股票数量: {count}支")
            print(f"  是否成功: {data.get('success', 'N/A')}")
            print(f"  API耗时: {data.get('elapsed', 0):.2f}秒")
            
            if count == 15:
                print(f"  [SUCCESS] Dashboard默认已改为15支股票")
            else:
                print(f"  [ERROR] 股票数量: {count}支 (应为15支)")
            
            # 显示股票列表
            symbols = [stock.get('symbol') for stock in stocks]
            print(f"\n  当前15支股票列表:")
            for i, symbol in enumerate(sorted(symbols), 1):
                stock_data = next((s for s in stocks if s.get('symbol') == symbol), {})
                price = stock_data.get('price')
                change_percent = stock_data.get('changePercent', 0)
                sector = stock_data.get('sector', 'N/A')
                
                # 分类
                tech_stocks = ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "ADBE"]
                financial_stocks = ["JPM", "V", "MA"]
                defensive_stocks = ["JNJ", "PG", "WMT", "UNH", "HD"]
                
                category = ""
                if symbol in tech_stocks:
                    category = "科技"
                elif symbol in financial_stocks:
                    category = "金融"
                elif symbol in defensive_stocks:
                    category = "防御"
                elif symbol == "TSLA":
                    category = "汽车"
                else:
                    category = "其他"
                
                print(f"    {i:2d}. {symbol}: ${price or 'N/A'} "
                      f"({change_percent:+.2f}%), "
                      f"行业: {sector[:15]}, "
                      f"分类: {category}")
            
            # 分析涨跌平衡
            print(f"\n2. 涨跌平衡分析")
            print("-" * 40)
            
            gainers = [s for s in stocks if s.get('changePercent', 0) > 0.1]
            losers = [s for s in stocks if s.get('changePercent', 0) < -0.1]
            neutral = [s for s in stocks if -0.1 <= s.get('changePercent', 0) <= 0.1]
            
            print(f"  上涨 (>0.1%): {len(gainers)}支")
            print(f"  下跌 (<-0.1%): {len(losers)}支")
            print(f"  平盘 (±0.1%): {len(neutral)}支")
            
            # 目标：7涨7跌1平
            print(f"\n  目标平衡: 7涨7跌1平")
            print(f"  实际平衡: {len(gainers)}涨{len(losers)}跌{len(neutral)}平")
            
            if 5 <= len(gainers) <= 9 and 5 <= len(losers) <= 9:
                print(f"  [INFO] 涨跌相对平衡")
            elif len(gainers) > 10:
                print(f"  [WARNING] 上涨股票偏多")
            elif len(losers) > 10:
                print(f"  [WARNING] 下跌股票偏多")
            
            # 检查必须包含的股票
            print(f"\n3. 必须包含检查")
            print("-" * 40)
            
            must_have = ["TSLA", "AAPL"]
            missing = [s for s in must_have if s not in symbols]
            
            if not missing:
                print(f"  [SUCCESS] 必须包含: TSLA和AAPL都在列表中")
            else:
                print(f"  [ERROR] 缺失: {', '.join(missing)}")
            
            # 科技股分析
            print(f"\n4. 科技股分析")
            print("-" * 40)
            
            tech_symbols = [s for s in symbols if s in ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "ADBE", "AMZN"]]
            print(f"  科技股: {', '.join(tech_symbols)}")
            print(f"  数量: {len(tech_symbols)}/15 = {len(tech_symbols)/15*100:.1f}%")
            
            if len(tech_symbols) >= 5:
                print(f"  [SUCCESS] 科技股充足")
            else:
                print(f"  [WARNING] 科技股偏少")
            
            # 最大涨跌幅
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
            
            if elapsed < 5:
                print(f"  [SUCCESS] 性能优秀: {elapsed:.2f}秒")
            elif elapsed < 10:
                print(f"  [INFO] 性能良好: {elapsed:.2f}秒")
            elif elapsed < 20:
                print(f"  [WARNING] 性能一般: {elapsed:.2f}秒")
            else:
                print(f"  [ERROR] 性能较差: {elapsed:.2f}秒")
                
        else:
            print(f"  请求失败: {response.status_code}")
            print(f"  响应: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        elapsed = time.time() - start_time
        print(f"  [ERROR] 请求超时 ({elapsed:.2f}秒)")
        print(f"  15支股票可能仍然会超时，需要进一步优化")
    except Exception as e:
        print(f"  [ERROR] 请求异常: {str(e)}")
    
    print(f"\n" + "=" * 60)

if __name__ == "__main__":
    test_15_stocks()